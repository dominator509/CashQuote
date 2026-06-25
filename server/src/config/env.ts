import { AppError } from '../middlewares/error';

const DEV_JWT_SECRET = 'development-only-jwt-secret';

export interface ProductionReadinessConfig {
  appOrigin: string;
  corsOrigins: string[];
  jwtSecret: string;
  databaseUrl: string;
  pilotAccessCode: string;
}

const isTruthy = (value: string | undefined): boolean => value === 'true' || value === '1';

export const isProduction = (): boolean => process.env.NODE_ENV === 'production';

export const isDemoLoginAllowed = (): boolean =>
  !isProduction() || isTruthy(process.env.ALLOW_DEMO_LOGIN);

export const isMockEmailAllowed = (): boolean =>
  !isProduction() || isTruthy(process.env.ALLOW_MOCK_EMAIL);

export const getCorsOrigins = (): string[] => {
  const configured = process.env.CORS_ORIGIN || process.env.APP_ORIGIN || 'http://localhost:5173';
  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const getPilotEmailAllowlist = (): string[] =>
  (process.env.PILOT_EMAIL_ALLOWLIST || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const getJwtSecret = (): string => {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (isProduction()) {
    throw new AppError('JWT_SECRET must be configured in production', 500, 'CONFIG_MISSING');
  }

  return DEV_JWT_SECRET;
};

export const getProductionReadinessConfig = (): ProductionReadinessConfig => {
  const missing = ['DATABASE_URL', 'JWT_SECRET', 'APP_ORIGIN', 'PILOT_ACCESS_CODE'].filter(
    (key) => !process.env[key]
  );

  if (missing.length > 0) {
    throw new AppError(
      `Missing required production environment: ${missing.join(', ')}`,
      500,
      'CONFIG_MISSING'
    );
  }

  return {
    appOrigin: process.env.APP_ORIGIN!,
    corsOrigins: getCorsOrigins(),
    jwtSecret: process.env.JWT_SECRET!,
    databaseUrl: process.env.DATABASE_URL!,
    pilotAccessCode: process.env.PILOT_ACCESS_CODE!,
  };
};

export const assertProductionReady = (): void => {
  if (isProduction()) {
    getProductionReadinessConfig();
  }
};
