import { Request, Response } from 'express';
import { prisma } from 'db';
import { z } from 'zod';
import { generateLineItemsWithFallback } from '../services/ai/generation.service';
import { logActivity } from '../services/activity/activity.service';

const MAX_AI_NOTES_LENGTH = 5000;

const generateSchema = z.object({
  notes: z.string().min(1).max(MAX_AI_NOTES_LENGTH),
});

export const generateLineItems = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const { notes } = generateSchema.parse(req.body);

  const result = await generateLineItemsWithFallback(notes);

  await prisma.aiRequest.create({
    data: {
      businessId,
      prompt: notes,
      response: JSON.stringify({
        items: result.items,
        provider: result.provider,
        degraded: result.degraded,
        error: result.error,
      }),
      status: result.degraded ? 'degraded' : 'success',
    },
  });

  if (result.degraded) {
    await logActivity({
      businessId,
      userId: req.user?.id,
      action: 'ai_degraded_fallback',
      entityType: 'ai_request',
      details: result.error,
    });
  }

  res.json({ items: result.items, provider: result.provider, degraded: result.degraded });
};
