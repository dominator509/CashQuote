import 'express-async-errors';
import express from 'express';
import cookieParser from 'cookie-parser';
import { demoLogin } from './controllers/auth.controller';
import { requireAuth } from './middlewares/auth';
import { requireBusinessId } from './middlewares/tenant';
import { errorHandler } from './middlewares/error';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

// Public Routes
app.post('/api/auth/demo-login', demoLogin);

// Protected Routes
app.get('/api/test-protected', requireAuth, requireBusinessId, (req, res) => {
  res.json({
    message: 'Access granted',
    userId: req.user?.id,
    businessId: req.business?.id,
  });
});

// Global Error Handler
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

export default app;
