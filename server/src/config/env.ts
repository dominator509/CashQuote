import { AppError } from '../middlewares/error';

const DEV_JWT_SECRET = 'development-only-jwt-secret';
const MIN_PRODUCTION_PILOT_ACCESS_CODE_LENGTH = 16;
const WEAK_PILOT_ACCESS_CODES = new Set([
  'pilot-code',
  'e2e-pilot-code',
  'demo',
  'password',
  'replace-with-private-pilot-code',
]);

export interface ProductionReadinessConfig {
  appOrigin: string;
  corsOrigins: string[];
  jwtSecret: string;
  databaseUrl: string;
  pilotAccessCode: string;
  smtpUrl: string;
  smtpFrom: string;
}

const isTruthy = (value: string | undefined): boolean => value === 'true' || value === '1';

export const isProduction = (): boolean => process.env.NODE_ENV === 'production';

const ensureProductionWebOrigin = (origin: string, key: string): void => {
  if (!isProduction()) {
    return;
  }

  if (origin === '*') {
    throw new AppError(`${key} must not use a wildcard in production`, 500, 'CONFIG_INVALID_ORIGIN');
  }

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new AppError(`${key} must be a valid HTTP(S) origin`, 500, 'CONFIG_INVALID_ORIGIN');
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
    throw new AppError(`${key} must be a valid HTTP(S) origin`, 500, 'CONFIG_INVALID_ORIGIN');
  }
};

export const isDemoLoginAllowed = (): boolean =>
  !isProduction() || isTruthy(process.env.ALLOW_DEMO_LOGIN);

export const isMockEmailAllowed = (): boolean =>
  !isProduction() || isTruthy(process.env.ALLOW_MOCK_EMAIL);

export const getCorsOrigins = (): string[] => {
  const configured = process.env.CORS_ORIGIN || process.env.APP_ORIGIN || 'http://localhost:5173';
  const origins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  origins.forEach((origin) => ensureProductionWebOrigin(origin, 'CORS_ORIGIN'));
  return origins;
};

export const getPilotEmailAllowlist = (): string[] =>
  (process.env.PILOT_EMAIL_ALLOWLIST || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const getJwtSecret = (): string => {
  if (process.env.JWT_SECRET) {
    if (isProduction() && process.env.JWT_SECRET === DEV_JWT_SECRET) {
      throw new AppError(
        'JWT_SECRET must not use the development default in production',
        500,
        'CONFIG_WEAK_SECRET'
      );
    }

    return process.env.JWT_SECRET;
  }

  if (isProduction()) {
    throw new AppError('JWT_SECRET must be configured in production', 500, 'CONFIG_MISSING');
  }

  return DEV_JWT_SECRET;
};

export const getPilotAccessCode = (): string => {
  const accessCode = process.env.PILOT_ACCESS_CODE;
  if (!accessCode) {
    throw new AppError('Pilot access code is not configured', 500, 'CONFIG_MISSING');
  }

  if (
    isProduction() &&
    (accessCode.length < MIN_PRODUCTION_PILOT_ACCESS_CODE_LENGTH ||
      WEAK_PILOT_ACCESS_CODES.has(accessCode.toLowerCase()))
  ) {
    throw new AppError(
      'PILOT_ACCESS_CODE must be a private, non-default value in production',
      500,
      'CONFIG_WEAK_ACCESS_CODE'
    );
  }

  return accessCode;
};

export const getProductionReadinessConfig = (): ProductionReadinessConfig => {
  const missing = [
    'DATABASE_URL',
    'JWT_SECRET',
    'APP_ORIGIN',
    'PILOT_ACCESS_CODE',
    'SMTP_URL',
    'SMTP_FROM',
  ].filter(
    (key) => !process.env[key]
  );

  if (missing.length > 0) {
    throw new AppError(
      `Missing required production environment: ${missing.join(', ')}`,
      500,
      'CONFIG_MISSING'
    );
  }

  const jwtSecret = getJwtSecret();
  const pilotAccessCode = getPilotAccessCode();
  ensureProductionWebOrigin(process.env.APP_ORIGIN!, 'APP_ORIGIN');

  return {
    appOrigin: process.env.APP_ORIGIN!,
    corsOrigins: getCorsOrigins(),
    jwtSecret,
    databaseUrl: process.env.DATABASE_URL!,
    pilotAccessCode,
    smtpUrl: process.env.SMTP_URL!,
    smtpFrom: process.env.SMTP_FROM!,
  };
};

export const assertProductionReady = (): void => {
  if (isProduction()) {
    getProductionReadinessConfig();
  }
};
