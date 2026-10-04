// Logs estructurados en JSON (base de la observabilidad en producción).
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  base: { servicio: 'viandassemana-api' },
  // Nunca se registran credenciales.
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.passwordHash'],
});
