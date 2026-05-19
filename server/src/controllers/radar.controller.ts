import { Request, Response } from 'express';
import { getLostCashInsights } from '../services/radar/radar.service';

export const getInsights = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const insights = await getLostCashInsights(businessId);
  res.json(insights);
};
