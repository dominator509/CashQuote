import OpenAI from 'openai';
import { IAIService, AIGeneratedLineItem, aiGeneratedLineItemSchema } from './ai.service';
import { z } from 'zod';
import { AppError } from '../../middlewares/error';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const schema = z.object({
  items: z.array(aiGeneratedLineItemSchema)
});

export class OpenAiAdapter implements IAIService {
  async generateLineItems(notes: string): Promise<AIGeneratedLineItem[]> {
    if (!openai) {
      throw new AppError('OpenAI API key is missing', 500);
    }

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert billing assistant. Convert the user's rough job notes into professional billing line items.
            Output must be strictly JSON matching this structure: { "items": [{ "description": string, "quantity": number, "price": number, "category": string }] }.
            Price must be an integer representing cents (e.g., $100.00 is 10000).`
          },
          { role: 'user', content: notes }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed = JSON.parse(content);
      const validated = schema.parse(parsed);

      return validated.items;
    } catch (error) {
      console.error('OpenAI adapter error:', error);
      throw new AppError('AI generation failed. Please try again manually.', 500);
    }
  }
}
