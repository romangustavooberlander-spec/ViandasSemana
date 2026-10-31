import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { menusRouter } from './routes/menus';
import { pedidosRouter } from './routes/pedidos';
import { pagosRouter } from './routes/pagos';
import { usuariosRouter } from './routes/usuarios';
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
  app.use(express.json({ limit: '400kb' })); // alcanza para la foto de un menú
  app.use(pinoHttp({ logger }));

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/menus', menusRouter);
  app.use('/api/pedidos', pedidosRouter);
  app.use('/api/pagos', pagosRouter);
  app.use('/api/usuarios', usuariosRouter);

  app.use(noEncontrado);
  app.use(manejadorErrores);

  return app;
}

// Vercel ejecuta la API como una función: toma este export por defecto (no usa app.listen).
// En local y en los tests se sigue usando crearApp / server.ts como siempre.
export default crearApp({ corsOrigins: env.corsOrigins });
