"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateInvoiceSchema = exports.createInvoiceSchema = exports.updateQuoteSchema = exports.createQuoteSchema = exports.lineItemSchema = exports.updateClientSchema = exports.createClientSchema = exports.test = void 0;
const zod_1 = require("zod");
exports.test = 'test';
exports.createClientSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    email: zod_1.z.string().email().optional().nullable(),
    billingAddress: zod_1.z.string().optional().nullable(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.updateClientSchema = exports.createClientSchema.partial();
exports.lineItemSchema = zod_1.z.object({
    id: zod_1.z.string().uuid().optional(),
    description: zod_1.z.string().min(1),
    quantity: zod_1.z.number().int().min(1),
    price: zod_1.z.number().int().min(0),
    category: zod_1.z.string().optional().nullable(),
});
exports.createQuoteSchema = zod_1.z.object({
    clientId: zod_1.z.string().uuid(),
    status: zod_1.z.enum(['draft', 'sent', 'accepted', 'rejected']).optional(),
    taxRatePercent: zod_1.z.number().min(0).max(100).optional().default(0),
    discountAmount: zod_1.z.number().int().min(0).optional().default(0),
    lineItems: zod_1.z.array(exports.lineItemSchema).optional().default([]),
});
exports.updateQuoteSchema = zod_1.z.object({
    status: zod_1.z.enum(['draft', 'sent', 'accepted', 'rejected']).optional(),
    taxRatePercent: zod_1.z.number().min(0).max(100).optional(),
    discountAmount: zod_1.z.number().int().min(0).optional(),
    lineItems: zod_1.z.array(exports.lineItemSchema).optional(),
});
exports.createInvoiceSchema = zod_1.z.object({
    clientId: zod_1.z.string().uuid(),
    status: zod_1.z.enum(['unpaid', 'paid', 'void']).optional(),
    taxRatePercent: zod_1.z.number().min(0).max(100).optional().default(0),
    discountAmount: zod_1.z.number().int().min(0).optional().default(0),
    dueDate: zod_1.z.string().datetime().optional().nullable(),
    lineItems: zod_1.z.array(exports.lineItemSchema).optional().default([]),
});
exports.updateInvoiceSchema = zod_1.z.object({
    status: zod_1.z.enum(['unpaid', 'paid', 'void']).optional(),
    taxRatePercent: zod_1.z.number().min(0).max(100).optional(),
    discountAmount: zod_1.z.number().int().min(0).optional(),
    dueDate: zod_1.z.string().datetime().optional().nullable(),
    lineItems: zod_1.z.array(exports.lineItemSchema).optional(),
});
