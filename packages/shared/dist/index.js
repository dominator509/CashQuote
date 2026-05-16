import { z } from 'zod';
export const test = 'test';
export const createClientSchema = z.object({
    name: z.string().min(1),
    email: z.string().email().optional().nullable(),
    billingAddress: z.string().optional().nullable(),
    tags: z.array(z.string()).optional(),
});
export const updateClientSchema = createClientSchema.partial();
export const lineItemSchema = z.object({
    id: z.string().uuid().optional(),
    description: z.string().min(1),
    quantity: z.number().int().min(1),
    price: z.number().int().min(0),
    category: z.string().optional().nullable(),
});
export const createQuoteSchema = z.object({
    clientId: z.string().uuid(),
    status: z.enum(['draft', 'sent', 'accepted', 'rejected']).optional(),
    taxRatePercent: z.number().min(0).max(100).optional().default(0),
    discountAmount: z.number().int().min(0).optional().default(0),
    lineItems: z.array(lineItemSchema).optional().default([]),
});
export const updateQuoteSchema = z.object({
    status: z.enum(['draft', 'sent', 'accepted', 'rejected']).optional(),
    taxRatePercent: z.number().min(0).max(100).optional(),
    discountAmount: z.number().int().min(0).optional(),
    lineItems: z.array(lineItemSchema).optional(),
});
export const createInvoiceSchema = z.object({
    clientId: z.string().uuid(),
    status: z.enum(['unpaid', 'paid', 'void']).optional(),
    taxRatePercent: z.number().min(0).max(100).optional().default(0),
    discountAmount: z.number().int().min(0).optional().default(0),
    dueDate: z.string().datetime().optional().nullable(),
    lineItems: z.array(lineItemSchema).optional().default([]),
});
export const updateInvoiceSchema = z.object({
    status: z.enum(['unpaid', 'paid', 'void']).optional(),
    taxRatePercent: z.number().min(0).max(100).optional(),
    discountAmount: z.number().int().min(0).optional(),
    dueDate: z.string().datetime().optional().nullable(),
    lineItems: z.array(lineItemSchema).optional(),
});
