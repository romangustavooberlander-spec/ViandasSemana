import { Router } from 'express';

export const healthRouter = Router();

// Permite comprobar que la API está viva (lo usa la plataforma de despliegue).
healthRouter.get('/', (_req, res) => {
  res.status(200).json({ estado: 'ok', servicio: 'viandassemana-api', hora: new Date().toISOString() });
});
