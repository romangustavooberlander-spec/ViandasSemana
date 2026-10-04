import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/errors';
import { logger } from '../lib/logger';

export const noEncontrado: RequestHandler = (req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado', ruta: req.originalUrl });
};

// Manejador central: ningún error de datos inválidos llega como 500.
export const manejadorErrores: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Datos inválidos',
      detalles: err.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    });
    return;
  }

  // JSON mal formado en el body.
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido' });
    return;
  }

  if (err instanceof HttpError) {
    if (err.codigo) {
      // Evento de negocio relevante para la observabilidad (ej: pedido rechazado por cupo).
      logger.warn({ evento: 'regla_negocio', codigo: err.codigo, ruta: req.originalUrl }, err.message);
    }
    res.status(err.status).json({ error: err.message, codigo: err.codigo });
    return;
  }

  logger.error({ evento: 'error_servidor', err, ruta: req.originalUrl }, 'Error no controlado');
  res.status(500).json({ error: 'Error interno del servidor' });
};
