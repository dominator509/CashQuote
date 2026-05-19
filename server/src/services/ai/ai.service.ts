import { z } from 'zod';

export const aiGeneratedLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().int().min(1),
  price: z.number().int().min(0),
  category: z.string().optional().nullable(),
});

export type AIGeneratedLineItem = z.infer<typeof aiGeneratedLineItemSchema>;

export interface IAIService {
  generateLineItems(notes: string): Promise<AIGeneratedLineItem[]>;
}
