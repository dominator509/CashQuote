import { Request, Response } from 'express';
import { prisma } from 'db';
import { z } from 'zod';
import { MockAiAdapter } from '../services/ai/mock.adapter';
import { OpenAiAdapter } from '../services/ai/openai.adapter';

const generateSchema = z.object({
  notes: z.string().min(1),
});

export const generateLineItems = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const { notes } = generateSchema.parse(req.body);

  // Fallback to mock adapter if API key is not present, adhering to Jules guardrails.
  const aiService = process.env.OPENAI_API_KEY ? new OpenAiAdapter() : new MockAiAdapter();

  try {
    const items = await aiService.generateLineItems(notes);

    // Log the successful request telemetry
    await prisma.aiRequest.create({
      data: {
        businessId,
        prompt: notes,
        response: JSON.stringify(items),
        status: 'success',
      },
    });

    res.json({ items });
  } catch (error) {
    // Log the failed request telemetry
    await prisma.aiRequest.create({
      data: {
        businessId,
        prompt: notes,
        response: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed',
      },
    });

    throw error;
  }
};
