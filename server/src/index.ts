import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cookieParser from 'cookie-parser';
import { prisma } from 'db';
import { demoLogin, logout, me, pilotLogin } from './controllers/auth.controller';
import { healthz, readyz } from './controllers/health.controller';
import { requireAuth } from './middlewares/auth';
import { requireBusinessId } from './middlewares/tenant';
import { errorHandler } from './middlewares/error';
import {
  aiRateLimit,
  authRateLimit,
  corsMiddleware,
  readinessRateLimit,
  securityHeaders,
} from './middlewares/security';
import { requestLogger } from './middlewares/request-logger';
import { assertProductionReady, getTrustProxy, isProduction } from './config/env';
import { getStaticClientBuild } from './config/static-client';
import { logger } from './services/logger/logger.service';

import clientRoutes from './routes/client.routes';
import quoteRoutes from './routes/quote.routes';
import invoiceRoutes from './routes/invoice.routes';
import aiRoutes from './routes/ai.routes';
import radarRoutes from './routes/radar.routes';
import reminderRoutes from './routes/reminder.routes';
import activityRoutes from './routes/activity.routes';

const app = express();
const port = process.env.PORT || 3000;

const trustProxy = getTrustProxy();
if (trustProxy !== false) {
  app.set('trust proxy', trustProxy);
}

app.use(requestLogger);
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/healthz', healthz);
app.get('/readyz', readinessRateLimit, readyz);

// Public Routes
app.post('/api/auth/demo-login', authRateLimit, demoLogin);
app.post('/api/auth/pilot-login', authRateLimit, pilotLogin);
app.get('/api/auth/me', requireAuth, me);
app.post('/api/auth/logout', requireAuth, logout);

// Protected Routes
const apiRouter = express.Router();
apiRouter.use(requireAuth);
apiRouter.use(requireBusinessId);

apiRouter.use('/clients', clientRoutes);
apiRouter.use('/quotes', quoteRoutes);
apiRouter.use('/invoices', invoiceRoutes);
apiRouter.use('/ai', aiRateLimit, aiRoutes);
apiRouter.use('/radar', radarRoutes);
apiRouter.use('/reminders', reminderRoutes);
apiRouter.use('/activity-logs', activityRoutes);

app.use('/api', apiRouter);

if (isProduction()) {
  const { clientDist, clientIndex } = getStaticClientBuild();

  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      next();
      return;
    }
    res.sendFile(clientIndex);
  });
}

// Global Error Handler
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  assertProductionReady();
  const server = app.listen(port, () => {
    logger.info({ port }, `Server listening on port ${port}`);
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down server');
    server.close(() => {
      prisma
        .$disconnect()
        .then(() => process.exit(0))
        .catch((error: unknown) => {
          logger.error({ error }, 'Failed to disconnect Prisma');
          process.exit(1);
        });
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export default app;
