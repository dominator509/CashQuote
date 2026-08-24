import { Request, Response } from 'express';
import { prisma } from 'db';
import { AppError } from '../middlewares/error';
import { createClientSchema, updateClientSchema } from 'shared';
import { logActivity } from '../services/activity/activity.service';

export const getClients = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const clients = await prisma.client.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(clients);
};

export const getClientById = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const { id } = req.params;

  const client = await prisma.client.findFirst({
    where: { id, businessId },
  });

  if (!client) {
    throw new AppError('Client not found', 404);
  }

  res.json(client);
};

export const createClient = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const data = createClientSchema.parse(req.body);

  const client = await prisma.client.create({
    data: {
      ...data,
      businessId,
      tags: data.tags || [],
    },
  });

  await logActivity({
    businessId,
    userId: req.user?.id,
    action: 'client_create',
    entityId: client.id,
    entityType: 'client',
  });

  res.status(201).json(client);
};

export const updateClient = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const { id } = req.params;
  const data = updateClientSchema.parse(req.body);

  const client = await prisma.client.findFirst({
    where: { id, businessId },
  });

  if (!client) {
    throw new AppError('Client not found', 404);
  }

  const updatedClient = await prisma.client.update({
    where: { id },
    data: {
      ...data,
      tags: data.tags ?? undefined,
    },
  });

  await logActivity({
    businessId,
    userId: req.user?.id,
    action: 'client_update',
    entityId: updatedClient.id,
    entityType: 'client',
  });

  res.json(updatedClient);
};

export const deleteClient = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const { id } = req.params;

  const client = await prisma.client.findFirst({
    where: { id, businessId },
    include: { _count: { select: { quotes: true, invoices: true } } },
  });

  if (!client) {
    throw new AppError('Client not found', 404);
  }

  if (client._count.quotes > 0 || client._count.invoices > 0) {
    throw new AppError(
      'Client has financial records and cannot be deleted',
      409,
      'CLIENT_HAS_FINANCIAL_RECORDS'
    );
  }

  await prisma.client.delete({
    where: { id },
  });

  await logActivity({
    businessId,
    userId: req.user?.id,
    action: 'client_delete',
    entityId: id,
    entityType: 'client',
  });

  res.status(204).send();
};
