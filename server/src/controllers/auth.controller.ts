import { Request, Response } from 'express';
import { prisma } from 'db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-prod';

export const demoLogin = async (req: Request, res: Response) => {
  let user = await prisma.user.findFirst({ where: { email: 'demo@quotecash.com' } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'demo@quotecash.com',
        role: 'owner',
      },
    });
  }

  let business = await prisma.business.findFirst({ where: { name: 'Demo Business' } });

  if (!business) {
    business = await prisma.business.create({
      data: {
        name: 'Demo Business',
      },
    });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    message: 'Logged in successfully',
    user: { id: user.id, email: user.email, role: user.role },
    business: { id: business.id, name: business.name },
  });
};
