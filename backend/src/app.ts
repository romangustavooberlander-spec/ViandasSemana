import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { logger } from './lib/logger';
import { healthRouter } from './routes/health';
import { manejadorErrores, noEncontrado } from './middleware/errorHandler';

export interface OpcionesApp {
  corsOrigins: string[];
}

// La app se construye en una función para poder testearla sin levantar el servidor.
export function crearApp({ corsOrigins }: OpcionesApp) {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(pinoHttp({ logger }));

  app.use('/api/health', healthRouter);

  app.use(noEncontrado);
  app.use(manejadorErrores);

  return app;
}
