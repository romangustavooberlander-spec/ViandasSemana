import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/errors';
import { autenticar, exigirRol } from '../middleware/auth';
import { validarCancelacion, validarNuevoPedido } from '../domain/reglasPedido';

export const pedidosRouter = Router();

const esquemaPedido = z.object({
  menuId: z.number().int().positive(),
  cantidad: z.number().int().min(1),
});

const esquemaId = z.coerce.number().int().positive();

pedidosRouter.use(autenticar);

// El cocinero ve todos los pedidos; el cliente, sólo los suyos.
pedidosRouter.get('/', async (req, res) => {
  const pedidos = await prisma.pedido.findMany({
    where: req.usuario!.rol === 'COCINERO' ? {} : { usuarioId: req.usuario!.id },
    include: { menu: true, usuario: { select: { id: true, nombre: true } } },
    orderBy: { creadoEn: 'desc' },
  });
  res.json(pedidos);
});

pedidosRouter.post('/', exigirRol('CLIENTE'), async (req, res) => {
  const { menuId, cantidad } = esquemaPedido.parse(req.body);

  // La transacción bloquea la fila del menú (FOR UPDATE): si llegan dos pedidos a la vez,
  // el segundo espera a que termine el primero y ya ve sus viandas reservadas.
  // Así nunca se supera el cupo.
  const pedido = await prisma.$transaction(async (tx) => {
    const bloqueado = await tx.$queryRaw<unknown[]>`SELECT id FROM "MenuDia" WHERE id = ${menuId} FOR UPDATE`;
    if (bloqueado.length === 0) throw new HttpError(404, 'Menú no encontrado');
    const menu = await tx.menuDia.findUniqueOrThrow({ where: { id: menuId } });
    const { _sum } = await tx.pedido.aggregate({
      where: { menuId, estado: 'ACTIVO' },
      _sum: { cantidad: true },
    });
    validarNuevoPedido({
      cantidad,
      cupoMaximo: menu.cupoMaximo,
      viandasReservadas: _sum.cantidad ?? 0,
      fechaMenu: menu.fecha,
      horaCorte: menu.horaCorte,
      ahora: new Date(),
    });
    return tx.pedido.create({ data: { menuId, cantidad, usuarioId: req.usuario!.id } });
  });

  res.status(201).json(pedido);
});

pedidosRouter.patch('/:id/cancelar', exigirRol('CLIENTE'), async (req, res) => {
  const id = esquemaId.parse(req.params.id);
  const pedido = await prisma.pedido.findUnique({ where: { id }, include: { menu: true } });
  // Un pedido ajeno se responde igual que uno inexistente, para no revelar que existe.
  if (!pedido || pedido.usuarioId !== req.usuario!.id) {
    throw new HttpError(404, 'Pedido no encontrado');
  }
  validarCancelacion({
    estado: pedido.estado,
    fechaMenu: pedido.menu.fecha,
    horaCorte: pedido.menu.horaCorte,
    ahora: new Date(),
  });
  const cancelado = await prisma.pedido.update({ where: { id }, data: { estado: 'CANCELADO' } });
  res.json(cancelado);
});
