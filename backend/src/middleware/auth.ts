import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { HttpError } from '../lib/errors';
import { prisma } from '../lib/prisma';

export interface DatosToken {
  id: number;
  v: number; // versionToken del usuario al momento del login
}

declare global {
  namespace Express {
    interface Request {
      usuario?: { id: number; rol: string };
    }
  }
}

// Exige un token válido. El usuario y su rol se leen de la base, nunca de lo que mande el cliente.
export const autenticar: RequestHandler = async (req, _res, next) => {
  try {
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new HttpError(401, 'Falta el token de sesión');

    let datos: DatosToken;
    try {
      datos = jwt.verify(token, env.jwtSecret) as DatosToken;
    } catch {
      throw new HttpError(401, 'Token inválido o vencido');
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: datos.id }, include: { rol: true } });
    // Si hizo logout, su versionToken cambió y este token ya no sirve.
    if (!usuario || usuario.versionToken !== datos.v) throw new HttpError(401, 'La sesión ya no es válida');

    req.usuario = { id: usuario.id, rol: usuario.rol.nombre };
    next();
  } catch (err) {
    next(err);
  }
};

// Se usa después de autenticar: deja pasar sólo a los roles indicados.
export function exigirRol(...roles: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      next(new HttpError(403, 'No tenés permiso para esta acción'));
      return;
    }
    next();
  };
}
