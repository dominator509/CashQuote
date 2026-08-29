import { z } from 'zod';

export const test = 'test';

export const createClientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().optional().nullable(),
  billingAddress: z.string().trim().max(1000).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
});

export const updateClientSchema = createClientSchema.partial();

export const lineItemSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().trim().min(1).max(500),
  quantity: z.number().int().min(1).max(10_000),
  price: z.number().int().min(0).max(100_000_000),
  category: z.string().trim().min(1).max(50).optional().nullable(),
});

// Prisma Int fields map to PostgreSQL INTEGER. Keep subtotal plus the
// maximum supported 100% tax rate within that persisted range.
export const MAX_DATABASE_INT = 2_147_483_647;
export const MAX_FINANCIAL_SUBTOTAL_CENTS = Math.floor(MAX_DATABASE_INT / 2);
export const MAX_LINE_ITEMS = 100;

export const persistedLineItemsSchema = z
  .array(lineItemSchema)
  .min(1)
  .max(MAX_LINE_ITEMS)
  .superRefine((items, context) => {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    if (subtotal > MAX_FINANCIAL_SUBTOTAL_CENTS) {
      context.addIssue({
        code: 'custom',
        message: 'Line item subtotal exceeds the supported financial limit',
      });
    }
  });

export const createQuoteSchema = z.object({
  clientId: z.string().uuid(),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected']).optional(),
  taxRatePercent: z.number().min(0).max(100).optional().default(0),
  discountAmount: z.number().int().min(0).max(MAX_FINANCIAL_SUBTOTAL_CENTS).optional().default(0),
  lineItems: persistedLineItemsSchema,
});

export const updateQuoteSchema = z.object({
  status: z.enum(['draft', 'sent', 'accepted', 'rejected']).optional(),
  taxRatePercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().int().min(0).max(MAX_FINANCIAL_SUBTOTAL_CENTS).optional(),
  lineItems: persistedLineItemsSchema.optional(),
});

export const createInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  status: z.enum(['unpaid', 'paid', 'void']).optional(),
  taxRatePercent: z.number().min(0).max(100).optional().default(0),
  discountAmount: z.number().int().min(0).max(MAX_FINANCIAL_SUBTOTAL_CENTS).optional().default(0),
  dueDate: z.string().datetime().optional().nullable(),
  lineItems: persistedLineItemsSchema,
});

export const updateInvoiceSchema = z.object({
  status: z.enum(['unpaid', 'paid', 'void']).optional(),
  taxRatePercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().int().min(0).max(MAX_FINANCIAL_SUBTOTAL_CENTS).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  lineItems: persistedLineItemsSchema.optional(),
});

export const createPaymentSchema = z.object({
  amount: z.number().int().min(1).max(MAX_DATABASE_INT),
  method: z.string().trim().min(1).max(50),
  paidAt: z.string().datetime().optional(),
});

export const createReminderSchema = z.object({
  entityType: z.enum(['quote', 'invoice']),
  entityId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
});

export const updateReminderStatusSchema = z.object({
  status: z.enum(['pending', 'sent', 'resolved']),
});

// Infer types
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type LineItemInput = z.infer<typeof lineItemSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type CreateReminderInput = z.infer<typeof createReminderSchema>;
