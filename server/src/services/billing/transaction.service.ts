import { prisma } from 'db';
import type { Prisma } from 'db';

const MAX_SERIALIZATION_RETRIES = 3;
const SERIALIZABLE_OPTIONS = {
  isolationLevel: 'Serializable' as Prisma.TransactionIsolationLevel,
};

const getPrismaErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
};

export const isPrismaErrorCode = (error: unknown, code: string): boolean =>
  getPrismaErrorCode(error) === code;

/**
 * Runs state-changing financial, reminder, and onboarding operations at
 * SERIALIZABLE isolation.
 * PostgreSQL may abort one of two concurrent transactions with P2034; retrying
 * lets the winning request complete while the retry observes committed state.
 */
export const runSerializableTransaction = async <T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> => {
  for (let attempt = 0; attempt <= MAX_SERIALIZATION_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(callback, SERIALIZABLE_OPTIONS);
    } catch (error) {
      if (!isPrismaErrorCode(error, 'P2034') || attempt === MAX_SERIALIZATION_RETRIES) {
        throw error;
      }
    }
  }

  throw new Error('Serializable transaction retry limit exceeded');
};
