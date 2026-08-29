"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateReminderStatusSchema = exports.createReminderSchema = exports.createPaymentSchema = exports.updateInvoiceSchema = exports.createInvoiceSchema = exports.updateQuoteSchema = exports.createQuoteSchema = exports.persistedLineItemsSchema = exports.MAX_LINE_ITEMS = exports.MAX_FINANCIAL_SUBTOTAL_CENTS = exports.MAX_DATABASE_INT = exports.lineItemSchema = exports.updateClientSchema = exports.createClientSchema = exports.test = void 0;
const zod_1 = require("zod");
exports.test = 'test';
exports.createClientSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(120),
    email: zod_1.z.string().trim().email().optional().nullable(),
    billingAddress: zod_1.z.string().trim().max(1000).optional().nullable(),
    tags: zod_1.z.array(zod_1.z.string().trim().min(1).max(50)).max(20).optional(),
});
exports.updateClientSchema = exports.createClientSchema.partial();
exports.lineItemSchema = zod_1.z.object({
    id: zod_1.z.string().uuid().optional(),
    description: zod_1.z.string().trim().min(1).max(500),
    quantity: zod_1.z.number().int().min(1).max(10_000),
    price: zod_1.z.number().int().min(0).max(100_000_000),
    category: zod_1.z.string().trim().min(1).max(50).optional().nullable(),
});
// Prisma Int fields map to PostgreSQL INTEGER. Keep subtotal plus the
// maximum supported 100% tax rate within that persisted range.
exports.MAX_DATABASE_INT = 2_147_483_647;
exports.MAX_FINANCIAL_SUBTOTAL_CENTS = Math.floor(exports.MAX_DATABASE_INT / 2);
exports.MAX_LINE_ITEMS = 100;
exports.persistedLineItemsSchema = zod_1.z
    .array(exports.lineItemSchema)
    .min(1)
    .max(exports.MAX_LINE_ITEMS)
    .superRefine((items, context) => {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    if (subtotal > exports.MAX_FINANCIAL_SUBTOTAL_CENTS) {
        context.addIssue({
            code: 'custom',
            message: 'Line item subtotal exceeds the supported financial limit',
        });
    }
});
exports.createQuoteSchema = zod_1.z.object({
    clientId: zod_1.z.string().uuid(),
    status: zod_1.z.enum(['draft', 'sent', 'accepted', 'rejected']).optional(),
    taxRatePercent: zod_1.z.number().min(0).max(100).optional().default(0),
    discountAmount: zod_1.z.number().int().min(0).max(exports.MAX_FINANCIAL_SUBTOTAL_CENTS).optional().default(0),
    lineItems: exports.persistedLineItemsSchema,
});
exports.updateQuoteSchema = zod_1.z.object({
    status: zod_1.z.enum(['draft', 'sent', 'accepted', 'rejected']).optional(),
    taxRatePercent: zod_1.z.number().min(0).max(100).optional(),
    discountAmount: zod_1.z.number().int().min(0).max(exports.MAX_FINANCIAL_SUBTOTAL_CENTS).optional(),
    lineItems: exports.persistedLineItemsSchema.optional(),
});
exports.createInvoiceSchema = zod_1.z.object({
    clientId: zod_1.z.string().uuid(),
    status: zod_1.z.enum(['unpaid', 'paid', 'void']).optional(),
    taxRatePercent: zod_1.z.number().min(0).max(100).optional().default(0),
    discountAmount: zod_1.z.number().int().min(0).max(exports.MAX_FINANCIAL_SUBTOTAL_CENTS).optional().default(0),
    dueDate: zod_1.z.string().datetime().optional().nullable(),
    lineItems: exports.persistedLineItemsSchema,
});
exports.updateInvoiceSchema = zod_1.z.object({
    status: zod_1.z.enum(['unpaid', 'paid', 'void']).optional(),
    taxRatePercent: zod_1.z.number().min(0).max(100).optional(),
    discountAmount: zod_1.z.number().int().min(0).max(exports.MAX_FINANCIAL_SUBTOTAL_CENTS).optional(),
    dueDate: zod_1.z.string().datetime().optional().nullable(),
    lineItems: exports.persistedLineItemsSchema.optional(),
});
exports.createPaymentSchema = zod_1.z.object({
    amount: zod_1.z.number().int().min(1).max(exports.MAX_DATABASE_INT),
    method: zod_1.z.string().trim().min(1).max(50),
    paidAt: zod_1.z.string().datetime().optional(),
});
exports.createReminderSchema = zod_1.z.object({
    entityType: zod_1.z.enum(['quote', 'invoice']),
    entityId: zod_1.z.string().uuid(),
    scheduledAt: zod_1.z.string().datetime(),
});
exports.updateReminderStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['pending', 'sent', 'resolved']),
});
