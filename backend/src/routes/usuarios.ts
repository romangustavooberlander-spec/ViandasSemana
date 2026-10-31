import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../lib/errors';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { autenticar, exigirRol } from '../middleware/auth';

// Administración de usuarios: sólo el ADMINISTRADOR lista usuarios y asigna o quita el rol COCINERO.
export const usuariosRouter = Router();
usuariosRouter.use(autenticar, exigirRol('ADMINISTRADOR'));

const seleccion = { id: true, nombre: true, email: true, rol: { select: { nombre: true } } } as const;
const aRespuesta = ({ rol, ...u }: { id: number; nombre: string; email: string; rol: { nombre: string } }) => ({
  ...u,
  rol: rol.nombre,
});

usuariosRouter.get('/', async (_req, res) => {
  const usuarios = await prisma.usuario.findMany({ select: seleccion, orderBy: { nombre: 'asc' } });
  res.json(usuarios.map(aRespuesta));
});

const esquemaRol = z.object({ rol: z.enum(['CLIENTE', 'COCINERO']) });

usuariosRouter.patch('/:id/rol', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const { rol } = esquemaRol.parse(req.body);
  const usuario = await prisma.usuario.findUnique({ where: { id }, include: { rol: true } });
  if (!usuario) throw new HttpError(404, 'Usuario no encontrado');
  if (usuario.rol.nombre === 'ADMINISTRADOR') throw new HttpError(400, 'No se puede cambiar el rol de un administrador');

  const actualizado = await prisma.usuario.update({
    where: { id },
    data: { rol: { connect: { nombre: rol } } },
    select: seleccion,
  });
  logger.info({ evento: 'rol_cambiado', usuarioId: id, rol, por: req.usuario!.id }, 'Rol cambiado');
  res.json(aRespuesta(actualizado));
});
