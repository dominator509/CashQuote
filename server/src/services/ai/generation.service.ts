import { AIGeneratedLineItem } from './ai.service';
import { MockAiAdapter } from './mock.adapter';
import { OpenAiAdapter } from './openai.adapter';

export interface AiGenerationResult {
  items: AIGeneratedLineItem[];
  provider: 'openai' | 'mock';
  degraded: boolean;
  error?: string;
}

export const generateLineItemsWithFallback = async (notes: string): Promise<AiGenerationResult> => {
  const mockAdapter = new MockAiAdapter();

  if (!process.env.OPENAI_API_KEY) {
    return {
      items: await mockAdapter.generateLineItems(notes),
      provider: 'mock',
      degraded: false,
    };
  }

  try {
    return {
      items: await new OpenAiAdapter().generateLineItems(notes),
      provider: 'openai',
      degraded: false,
    };
  } catch (error) {
    return {
      items: await mockAdapter.generateLineItems(notes),
      provider: 'mock',
      degraded: true,
      error: error instanceof Error ? error.message : 'Unknown AI provider error',
    };
  }
};
