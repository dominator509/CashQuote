import { z } from 'zod';

export const test = 'test';

export const createClientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().optional().nullable(),
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

export const createQuoteSchema = z.object({
  clientId: z.string().uuid(),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected']).optional(),
  taxRatePercent: z.number().min(0).max(100).optional().default(0),
  discountAmount: z.number().int().min(0).optional().default(0),
  lineItems: z.array(lineItemSchema).min(1),
});

export const updateQuoteSchema = z.object({
  status: z.enum(['draft', 'sent', 'accepted', 'rejected']).optional(),
  taxRatePercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().int().min(0).optional(),
  lineItems: z.array(lineItemSchema).min(1).optional(),
});

export const createInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  status: z.enum(['unpaid', 'paid', 'void']).optional(),
  taxRatePercent: z.number().min(0).max(100).optional().default(0),
  discountAmount: z.number().int().min(0).optional().default(0),
  dueDate: z.string().datetime().optional().nullable(),
  lineItems: z.array(lineItemSchema).min(1),
});

export const updateInvoiceSchema = z.object({
  status: z.enum(['unpaid', 'paid', 'void']).optional(),
  taxRatePercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().int().min(0).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  lineItems: z.array(lineItemSchema).min(1).optional(),
});

export const createPaymentSchema = z.object({
  amount: z.number().int().min(1),
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
