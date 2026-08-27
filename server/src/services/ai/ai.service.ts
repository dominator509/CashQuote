import { lineItemSchema } from 'shared';
import { z } from 'zod';

// AI output is consumed by quote/invoice creation, so it must use the same
// bounds as persisted line items. The optional client-only id is excluded.
export const aiGeneratedLineItemSchema = lineItemSchema.omit({ id: true });

export type AIGeneratedLineItem = z.infer<typeof aiGeneratedLineItemSchema>;

export interface IAIService {
  generateLineItems(notes: string): Promise<AIGeneratedLineItem[]>;
}
