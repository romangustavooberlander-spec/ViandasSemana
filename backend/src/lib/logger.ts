// Logs estructurados en JSON (base de la observabilidad en producción).
// En desarrollo se muestran legibles con pino-pretty.
import pino from 'pino';

const enDesarrollo = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  base: { servicio: 'viandassemana-api' },
  // Nunca se registran credenciales.
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.passwordHash'],
  ...(enDesarrollo ? { transport: { target: 'pino-pretty' } } : {}),
});
