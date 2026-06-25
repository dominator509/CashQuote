import { CookieOptions, Request, Response } from 'express';
import { prisma } from 'db';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import {
  getJwtSecret,
  getPilotEmailAllowlist,
  isDemoLoginAllowed,
} from '../config/env';
import { AppError } from '../middlewares/error';
import { logActivity } from '../services/activity/activity.service';

const pilotLoginSchema = z.object({
  email: z.string().email(),
  accessCode: z.string().min(1),
});

const getCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

const createSession = (res: Response, userId: string): void => {
  const token = jwt.sign({ userId }, getJwtSecret(), { expiresIn: '7d' });
  res.cookie('token', token, getCookieOptions());
};

const ensureOwnerMembership = async (email: string, businessName: string) => {
  let user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        role: 'owner',
      },
    });
  }

  const existingMembership = await prisma.businessMember.findFirst({
    where: { userId: user.id, role: 'owner' },
    include: { business: true },
  });

  if (existingMembership) {
    return { user, business: existingMembership.business };
  }

  let business = await prisma.business.findFirst({ where: { name: businessName } });
  if (!business) {
    business = await prisma.business.create({
      data: {
        name: businessName,
      },
    });
  }

  await prisma.businessMember.upsert({
    where: {
      userId_businessId: {
        userId: user.id,
        businessId: business.id,
      },
    },
    update: { role: 'owner' },
    create: {
      userId: user.id,
      businessId: business.id,
      role: 'owner',
    },
  });

  return { user, business };
};

export const demoLogin = async (_req: Request, res: Response) => {
  if (!isDemoLoginAllowed()) {
    throw new AppError('Demo login is disabled in production', 403, 'DEMO_LOGIN_DISABLED');
  }

  const { user, business } = await ensureOwnerMembership('demo@quotecash.com', 'Demo Business');

  await logActivity({
    businessId: business.id,
    userId: user.id,
    action: 'auth_demo_login',
    entityId: user.id,
    entityType: 'user',
  });

  createSession(res, user.id);

  res.json({
    message: 'Logged in successfully',
    user: { id: user.id, email: user.email, role: user.role },
    business: { id: business.id, name: business.name },
  });
};

export const pilotLogin = async (req: Request, res: Response) => {
  const data = pilotLoginSchema.parse(req.body);
  const configuredAccessCode = process.env.PILOT_ACCESS_CODE;

  if (!configuredAccessCode) {
    throw new AppError('Pilot access code is not configured', 500, 'CONFIG_MISSING');
  }

  if (data.accessCode !== configuredAccessCode) {
    throw new AppError('Invalid pilot access code', 401, 'INVALID_ACCESS_CODE');
  }

  const email = data.email.toLowerCase();
  const allowlist = getPilotEmailAllowlist();
  if (allowlist.length > 0 && !allowlist.includes(email)) {
    throw new AppError('Email is not allowed for this pilot', 403, 'EMAIL_NOT_ALLOWED');
  }

  const businessName = `${email.split('@')[0]} Pilot Business`;
  const { user, business } = await ensureOwnerMembership(email, businessName);

  await logActivity({
    businessId: business.id,
    userId: user.id,
    action: 'auth_pilot_login',
    entityId: user.id,
    entityType: 'user',
  });

  createSession(res, user.id);

  res.json({
    message: 'Logged in successfully',
    user: { id: user.id, email: user.email, role: user.role },
    business: { id: business.id, name: business.name },
  });
};

export const me = async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new AppError('Unauthorized: Missing user context', 401, 'UNAUTHORIZED');
  }

  const user = await prisma.user.findFirst({
    where: { id: req.user.id },
    include: {
      memberships: {
        include: { business: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!user || user.memberships.length === 0) {
    throw new AppError('Authenticated user has no business membership', 403, 'NO_BUSINESS_MEMBERSHIP');
  }

  const membership = user.memberships[0];
  res.json({
    user: { id: user.id, email: user.email, role: user.role },
    business: { id: membership.business.id, name: membership.business.name, role: membership.role },
    businesses: user.memberships.map((item) => ({
      id: item.business.id,
      name: item.business.name,
      role: item.role,
    })),
  });
};

export const logout = (_req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.status(204).send();
};
