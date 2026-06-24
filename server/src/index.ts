import 'express-async-errors';
import express from 'express';
import cookieParser from 'cookie-parser';
import { demoLogin } from './controllers/auth.controller';
import { requireAuth } from './middlewares/auth';
import { requireBusinessId } from './middlewares/tenant';
import { errorHandler } from './middlewares/error';

import clientRoutes from './routes/client.routes';
import quoteRoutes from './routes/quote.routes';
import invoiceRoutes from './routes/invoice.routes';
import aiRoutes from './routes/ai.routes';
import radarRoutes from './routes/radar.routes';
import reminderRoutes from './routes/reminder.routes';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

// Public Routes
app.post('/api/auth/demo-login', demoLogin);

// Protected Routes
const apiRouter = express.Router();
apiRouter.use(requireAuth);
apiRouter.use(requireBusinessId);

apiRouter.use('/clients', clientRoutes);
apiRouter.use('/quotes', quoteRoutes);
apiRouter.use('/invoices', invoiceRoutes);
apiRouter.use('/ai', aiRoutes);
apiRouter.use('/radar', radarRoutes);
apiRouter.use('/reminders', reminderRoutes);

apiRouter.get('/test-protected', (req, res) => {
  res.json({
    message: 'Access granted',
    userId: req.user?.id,
    businessId: req.business?.id,
  });
});

app.use('/api', apiRouter);

// Global Error Handler
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

export default app;
