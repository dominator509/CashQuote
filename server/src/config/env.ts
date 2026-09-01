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

export interface SmtpConfig {
  smtpUrl: string;
  smtpFrom: string;
}

const isTruthy = (value: string | undefined): boolean => value === 'true' || value === '1';
const isConfigured = (value: string | undefined): boolean => Boolean(value?.trim());

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
  !isProduction();

export const getTrustProxy = (): false | 1 => {
  const configured = process.env.TRUST_PROXY?.trim().toLowerCase();

  if (!configured || configured === 'false') {
    return false;
  }

  if (configured === 'true') {
    return 1;
  }

  throw new AppError(
    'TRUST_PROXY must be either true or false',
    500,
    'CONFIG_INVALID_TRUST_PROXY'
  );
};

export const getSmtpConfig = (): SmtpConfig => {
  const smtpUrl = process.env.SMTP_URL?.trim();
  const smtpFrom = process.env.SMTP_FROM?.trim();
  if (!smtpUrl || !smtpFrom) {
    const missing = [
      !smtpUrl ? 'SMTP_URL' : null,
      !smtpFrom ? 'SMTP_FROM' : null,
    ].filter((key): key is string => Boolean(key));
    throw new AppError(
      `Missing required production environment: ${missing.join(', ')}`,
      500,
      'CONFIG_MISSING'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(smtpUrl);
  } catch {
    throw new AppError('SMTP_URL must be a valid smtp:// or smtps:// URL', 500, 'CONFIG_INVALID_SMTP');
  }

  if (!['smtp:', 'smtps:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new AppError('SMTP_URL must be a valid smtp:// or smtps:// URL', 500, 'CONFIG_INVALID_SMTP');
  }

  return { smtpUrl, smtpFrom };
};

export const getCorsOrigins = (): string[] => {
  const configured = process.env.CORS_ORIGIN?.trim() || process.env.APP_ORIGIN || 'http://localhost:5173';
  const origins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new AppError('CORS_ORIGIN must contain at least one origin', 500, 'CONFIG_INVALID_ORIGIN');
  }

  origins.forEach((origin) => ensureProductionWebOrigin(origin, 'CORS_ORIGIN'));
  return origins;
};

export const getPilotEmailAllowlist = (): string[] =>
  (process.env.PILOT_EMAIL_ALLOWLIST || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const getJwtSecret = (): string => {
  if (isConfigured(process.env.JWT_SECRET)) {
    if (isProduction() && process.env.JWT_SECRET === DEV_JWT_SECRET) {
      throw new AppError(
        'JWT_SECRET must not use the development default in production',
        500,
        'CONFIG_WEAK_SECRET'
      );
    }

    return process.env.JWT_SECRET!;
  }

  if (isProduction()) {
    throw new AppError('JWT_SECRET must be configured in production', 500, 'CONFIG_MISSING');
  }

  return DEV_JWT_SECRET;
};

export const getPilotAccessCode = (): string => {
  const accessCode = process.env.PILOT_ACCESS_CODE?.trim();
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
  if (isTruthy(process.env.ALLOW_MOCK_EMAIL)) {
    throw new AppError(
      'ALLOW_MOCK_EMAIL must be disabled in production',
      500,
      'CONFIG_MOCK_EMAIL_NOT_ALLOWED'
    );
  }

  const missing = [
    'DATABASE_URL',
    'JWT_SECRET',
    'APP_ORIGIN',
    'PILOT_ACCESS_CODE',
  ].filter((key) => !isConfigured(process.env[key]));

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
  getTrustProxy();
  const { smtpUrl, smtpFrom } = getSmtpConfig();

  return {
    appOrigin: process.env.APP_ORIGIN!,
    corsOrigins: getCorsOrigins(),
    jwtSecret,
    databaseUrl: process.env.DATABASE_URL!,
    pilotAccessCode,
    smtpUrl,
    smtpFrom,
  };
};

export const assertProductionReady = (): void => {
  if (isProduction()) {
    getProductionReadinessConfig();
  }
};
