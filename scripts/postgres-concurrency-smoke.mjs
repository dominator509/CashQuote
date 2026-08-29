import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

// This is a database-invariant test, not a provider-delivery test. Keep its
// reminder assertion deterministic even when the validation command inherits
// production SMTP variables; production application startup still rejects
// mock email and is covered by the dedicated production smoke path.
process.env.NODE_ENV = 'test';
delete process.env.SMTP_URL;
delete process.env.SMTP_FROM;
process.env.ALLOW_MOCK_EMAIL = 'true';

const require = createRequire(import.meta.url);
const { prisma } = require('db');
const { createInvoicePayment } = require('../server/dist/services/billing/payment.service.js');
const { convertQuoteToInvoice } = require('../server/dist/services/billing/conversion.service.js');
const { deleteInvoice, updateInvoice } = require('../server/dist/controllers/invoice.controller.js');
const {
  createReminder,
  sendReminder,
} = require('../server/dist/services/reminders/reminder.service.js');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const createResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(value) {
    this.body = value;
    return this;
  },
  send() {
    return this;
  },
});

const createQuote = async (businessId, clientId, suffix, status = 'accepted') =>
  prisma.quote.create({
    data: {
      businessId,
      clientId,
      status,
      subtotal: 1000,
      tax: 0,
      discount: 0,
      total: 1000,
      lineItems: {
        create: {
          businessId,
          description: `Concurrency test quote ${suffix}`,
          quantity: 1,
          price: 1000,
        },
      },
    },
  });

const run = async () => {
  const suffix = randomUUID();
  let businessId;

  try {
    const business = await prisma.business.create({
      data: { name: `Concurrency smoke ${suffix}` },
    });
    businessId = business.id;

    const client = await prisma.client.create({
      data: {
        businessId,
        name: `Concurrency client ${suffix}`,
        email: 'concurrency-client@example.com',
        tags: [],
      },
    });

    const invoice = await prisma.invoice.create({
      data: {
        businessId,
        clientId: client.id,
        status: 'unpaid',
        subtotal: 1000,
        tax: 0,
        discount: 0,
        total: 1000,
        lineItems: {
          create: {
            businessId,
            description: 'Concurrency test invoice',
            quantity: 1,
            price: 1000,
          },
        },
      },
    });

    const attempts = await Promise.allSettled([
      createInvoicePayment(invoice.id, businessId, undefined, {
        amount: 600,
        method: 'concurrency-smoke',
      }),
      createInvoicePayment(invoice.id, businessId, undefined, {
        amount: 600,
        method: 'concurrency-smoke',
      }),
    ]);
    const fulfilled = attempts.filter((attempt) => attempt.status === 'fulfilled');

    const payments = await prisma.payment.findMany({
      where: { invoiceId: invoice.id, businessId },
      select: { amount: true },
    });
    const paidTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);

    assert(
      fulfilled.length === 1 && payments.length === 1 && paidTotal === 600,
      `Concurrent payment invariant failed: fulfilled=${fulfilled.length}, payments=${payments.length}, paidTotal=${paidTotal}`
    );

    const invoiceUpdateRace = await prisma.invoice.create({
      data: {
        businessId,
        clientId: client.id,
        status: 'unpaid',
        subtotal: 1000,
        tax: 0,
        discount: 0,
        total: 1000,
        lineItems: {
          create: {
            businessId,
            description: 'Concurrent invoice update test',
            quantity: 1,
            price: 1000,
          },
        },
      },
    });
    const updateResponse = createResponse();
    const updateRequest = {
      business: { id: businessId },
      params: { id: invoiceUpdateRace.id },
      body: {
        lineItems: [
          {
            description: 'Updated concurrent invoice',
            quantity: 1,
            price: 700,
          },
        ],
      },
      user: undefined,
    };
    const invoiceUpdateAttempts = await Promise.allSettled([
      createInvoicePayment(invoiceUpdateRace.id, businessId, undefined, {
        amount: 600,
        method: 'concurrency-smoke',
      }),
      updateInvoice(updateRequest, updateResponse),
    ]);
    const updatedInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceUpdateRace.id },
      include: { payments: true },
    });
    assert(
      invoiceUpdateAttempts.every((attempt) => attempt.status === 'fulfilled') &&
        updatedInvoice?.total === 700 &&
        updatedInvoice.payments.length === 1 &&
        updatedInvoice.payments[0].amount === 600 &&
        updatedInvoice.status === 'unpaid',
      `Invoice update/payment invariant failed: attempts=${invoiceUpdateAttempts.map((attempt) => attempt.status).join(',')}, total=${updatedInvoice?.total}, payments=${updatedInvoice?.payments.length}, status=${updatedInvoice?.status}`
    );

    const invoiceDeleteRace = await prisma.invoice.create({
      data: {
        businessId,
        clientId: client.id,
        status: 'unpaid',
        subtotal: 1000,
        tax: 0,
        discount: 0,
        total: 1000,
        lineItems: {
          create: {
            businessId,
            description: 'Concurrent invoice delete test',
            quantity: 1,
            price: 1000,
          },
        },
      },
    });
    const deleteResponse = createResponse();
    const deleteRequest = {
      business: { id: businessId },
      params: { id: invoiceDeleteRace.id },
      user: undefined,
    };
    const invoiceDeleteAttempts = await Promise.allSettled([
      createInvoicePayment(invoiceDeleteRace.id, businessId, undefined, {
        amount: 600,
        method: 'concurrency-smoke',
      }),
      deleteInvoice(deleteRequest, deleteResponse),
    ]);
    const survivingInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceDeleteRace.id },
      include: { payments: true },
    });
    assert(
      invoiceDeleteAttempts.filter((attempt) => attempt.status === 'fulfilled').length === 1 &&
        (!survivingInvoice ||
          (survivingInvoice.payments.length === 1 && survivingInvoice.payments[0].amount === 600)),
      `Invoice delete/payment invariant failed: attempts=${invoiceDeleteAttempts.map((attempt) => attempt.status).join(',')}, invoice=${Boolean(survivingInvoice)}, payments=${survivingInvoice?.payments.length ?? 0}`
    );

    const conversionQuote = await createQuote(businessId, client.id, `${suffix}-conversion`);
    const conversionAttempts = await Promise.allSettled([
      convertQuoteToInvoice(conversionQuote.id, businessId),
      convertQuoteToInvoice(conversionQuote.id, businessId),
    ]);
    const convertedInvoices = await prisma.invoice.findMany({
      where: { businessId, sourceQuoteId: conversionQuote.id },
    });
    assert(
      conversionAttempts.filter((attempt) => attempt.status === 'fulfilled').length === 1 &&
        convertedInvoices.length === 1,
      `Quote conversion invariant failed: fulfilled=${conversionAttempts.filter((attempt) => attempt.status === 'fulfilled').length}, invoices=${convertedInvoices.length}`
    );

    const reminderQuote = await createQuote(businessId, client.id, `${suffix}-reminder`, 'draft');
    const reminderInput = {
      entityType: 'quote',
      entityId: reminderQuote.id,
      scheduledAt: new Date().toISOString(),
    };
    const reminderAttempts = await Promise.allSettled([
      createReminder(businessId, undefined, reminderInput),
      createReminder(businessId, undefined, reminderInput),
    ]);
    const reminders = await prisma.reminder.findMany({
      where: { businessId, entityId: reminderQuote.id, entityType: 'quote' },
    });
    assert(
      reminderAttempts.filter((attempt) => attempt.status === 'fulfilled').length === 1 &&
        reminders.length === 1,
      `Reminder creation invariant failed: fulfilled=${reminderAttempts.filter((attempt) => attempt.status === 'fulfilled').length}, reminders=${reminders.length}`
    );

    const sendAttempts = await Promise.allSettled([
      sendReminder(businessId, undefined, reminders[0].id),
      sendReminder(businessId, undefined, reminders[0].id),
    ]);
    const sentReminder = await prisma.reminder.findUnique({
      where: { id: reminders[0].id },
    });
    const sendLogs = await prisma.activityLog.count({
      where: {
        businessId,
        action: 'reminder_send',
        entityId: reminders[0].id,
      },
    });
    assert(
      sendAttempts.filter((attempt) => attempt.status === 'fulfilled').length === 1 &&
        sentReminder?.status === 'sent' &&
        sendLogs === 1,
      `Reminder send invariant failed: fulfilled=${sendAttempts.filter((attempt) => attempt.status === 'fulfilled').length}, status=${sentReminder?.status}, logs=${sendLogs}`
    );

console.log('PostgreSQL concurrency smoke passed: payments, invoice update/payment, invoice delete/payment, conversion, reminder create, reminder send');
  } finally {
    if (businessId) {
      await prisma.business.delete({ where: { id: businessId } });
    }
    await prisma.$disconnect();
  }
};

await run();
