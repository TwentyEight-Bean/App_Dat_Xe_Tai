import express from 'express';
import type { IncomingMessage, ServerResponse } from 'node:http';
import authRoutes from './routes/auth';
import customerRoutes from './routes/customer';
import driverRoutes from './routes/driver';
import adminRoutes from './routes/admin';
import pricingRoutes from './routes/pricing';
import { errorHandler } from './middleware';

const app = express();

// Parse JSON payload
app.use(express.json({ limit: '1mb' }));

// CORS preflight and headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Routes
// We support both /api/v1/* and /api/*
const mountRoutes = (prefix: string) => {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/customer`, customerRoutes);
  app.use(`${prefix}/driver`, driverRoutes);
  app.use(`${prefix}/admin`, adminRoutes);
  app.use(`${prefix}/pricing`, pricingRoutes);
  app.use(`${prefix}/bookings/estimate`, pricingRoutes); // /api/bookings/estimate falls back to pricing
};

mountRoutes('/api/v1');
mountRoutes('/api');

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} không tồn tại`,
  });
});

// Error handling middleware
app.use(errorHandler);

/**
 * Router chính xử lý tất cả các API `/api/v1/*`
 */
export function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  return new Promise((resolve) => {
    const url = req.url || '';
    if (!url.startsWith('/api')) {
      resolve(false);
      return;
    }

    // Pass the request to the express app.
    // If it is an /api request, the express app will handle it (since we have a 404 handler inside).
    // When the response finishes, we resolve true.
    res.on('finish', () => {
      resolve(true);
    });

    app(req as express.Request, res as express.Response, () => {
      resolve(false);
    });
  });
}
