import { Request, Response } from 'express';
import { prisma } from 'db';
import { AppError } from '../middlewares/error';
import { createClientSchema, updateClientSchema } from 'shared';

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

  res.json(updatedClient);
};

export const deleteClient = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const { id } = req.params;

  const client = await prisma.client.findFirst({
    where: { id, businessId },
  });

  if (!client) {
    throw new AppError('Client not found', 404);
  }

  await prisma.client.delete({
    where: { id },
  });

  res.status(204).send();
};
