import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import createOrderHandler from './api/create-order.js';
import verifyPaymentHandler from './api/verify-payment.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // Mount the exact Vercel serverless API routes locally so /api/* works in dev & full-stack preview
  app.all('/api/create-order', (req, res) => {
    void createOrderHandler(req, res);
  });

  app.all('/api/verify-payment', (req, res) => {
    void verifyPaymentHandler(req, res);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ServeSmart server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
