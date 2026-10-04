import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/errors';
import { logger } from '../lib/logger';
import { crearPreferencia, devolverPago } from '../lib/mercadoPago';
import { OCUPAN_CUPO, vencerReservasImpagas } from '../lib/pagos';
import { autenticar, exigirRol } from '../middleware/auth';
import { validarCancelacion, validarNuevoPedido, vencimientoDelPago, yaPasoElCorte } from '../domain/reglasPedido';

export const pedidosRouter = Router();

const esquemaPedido = z.object({
  menuId: z.number().int().positive(),
  cantidad: z.number().int().min(1),
});

const esquemaId = z.coerce.number().int().positive();

pedidosRouter.use(autenticar);

// El cocinero ve todos los pedidos; el cliente, sólo los suyos.
// "cancelable" y "pagable" le dicen al frontend qué botones mostrar.
pedidosRouter.get('/', async (req, res) => {
  await vencerReservasImpagas();
  const pedidos = await prisma.pedido.findMany({
    where: req.usuario!.rol === 'COCINERO' ? {} : { usuarioId: req.usuario!.id },
    include: {
      menu: true,
      usuario: { select: { id: true, nombre: true } },
      pago: { select: { estado: true, monto: true, venceEn: true } },
    },
    orderBy: { creadoEn: 'desc' },
  });
  const ahora = new Date();
  res.json(
    pedidos.map((p) => ({
      ...p,
      cancelable: p.estado !== 'CANCELADO' && !yaPasoElCorte(p.menu.fecha, p.menu.horaCorte, ahora),
      pagable: p.estado === 'PENDIENTE_PAGO',
    })),
  );
});

// Crea la reserva PENDIENTE de pago y la preferencia de Mercado Pago por el 100 % del valor.
// La reserva queda confirmada recién cuando Mercado Pago aprueba el pago (ver lib/pagos.ts).
pedidosRouter.post('/', exigirRol('CLIENTE'), async (req, res) => {
  const { menuId, cantidad } = esquemaPedido.parse(req.body);

  // La transacción bloquea la fila del menú (FOR UPDATE): si llegan dos pedidos a la vez,
  // el segundo espera a que termine el primero y ya ve sus viandas reservadas.
  // Así nunca se supera el cupo.
  const { pedido, menu } = await prisma.$transaction(async (tx) => {
    const bloqueado = await tx.$queryRaw<unknown[]>`SELECT id FROM "MenuDia" WHERE id = ${menuId} FOR UPDATE`;
    if (bloqueado.length === 0) throw new HttpError(404, 'Menú no encontrado');
    const menu = await tx.menuDia.findUniqueOrThrow({ where: { id: menuId } });
    if (menu.precio <= 0) throw new HttpError(409, 'Este menú todavía no tiene precio', 'SIN_PRECIO');
    await vencerReservasImpagas(tx);
    const { _sum } = await tx.pedido.aggregate({
      where: { menuId, estado: OCUPAN_CUPO },
      _sum: { cantidad: true },
    });
    const ahora = new Date();
    validarNuevoPedido({
      cantidad,
      cupoMaximo: menu.cupoMaximo,
      viandasReservadas: _sum.cantidad ?? 0,
      fechaMenu: menu.fecha,
      horaCorte: menu.horaCorte,
      ahora,
    });
    const pedido = await tx.pedido.create({
      data: {
        menuId,
        cantidad,
        usuarioId: req.usuario!.id,
        pago: { create: { monto: cantidad * menu.precio, venceEn: vencimientoDelPago(menu.fecha, menu.horaCorte, ahora) } },
      },
      include: { pago: true },
    });
    return { pedido, menu };
  });

  // La preferencia se crea fuera de la transacción para no tener el menú bloqueado durante la llamada.
  let preferencia;
  try {
    preferencia = await crearPreferencia({
      pedidoId: pedido.id,
      titulo: `Vianda ${menu.fecha.toISOString().slice(0, 10)}: ${menu.descripcion}`.slice(0, 250),
      cantidad,
      precioUnitario: menu.precio,
      venceEn: pedido.pago!.venceEn,
    });
  } catch (err) {
    // Sin forma de pagar, la reserva no puede quedar ocupando el cupo.
    await prisma.pedido.update({
      where: { id: pedido.id },
      data: { estado: 'CANCELADO', pago: { update: { estado: 'CANCELADO' } } },
    });
    throw err;
  }
  const pago = await prisma.pago.update({
    where: { pedidoId: pedido.id },
    data: { preferenciaId: preferencia.id, urlPago: preferencia.init_point },
  });

  res.status(201).json({ ...pedido, pago, urlPago: pago.urlPago });
});

// Devuelve la URL de Mercado Pago para pagar (o reintentar el pago de) una reserva pendiente.
pedidosRouter.post('/:id/pagar', exigirRol('CLIENTE'), async (req, res) => {
  const id = esquemaId.parse(req.params.id);
  await vencerReservasImpagas();
  const pedido = await prisma.pedido.findUnique({ where: { id }, include: { pago: true } });
  if (!pedido || pedido.usuarioId !== req.usuario!.id) throw new HttpError(404, 'Pedido no encontrado');
  if (pedido.estado !== 'PENDIENTE_PAGO' || !pedido.pago?.urlPago) {
    throw new HttpError(
      409,
      pedido.estado === 'CONFIRMADO' ? 'Este pedido ya está pagado' : 'Esta reserva venció o se canceló. Hacé una nueva',
      'NO_PAGABLE',
    );
  }
  res.json({ urlPago: pedido.pago.urlPago });
});

pedidosRouter.patch('/:id/cancelar', exigirRol('CLIENTE'), async (req, res) => {
  const id = esquemaId.parse(req.params.id);

  const cancelado = await prisma.$transaction(async (tx) => {
    // Bloquea el pedido para que no se confirme un pago mientras se cancela.
    await tx.$queryRaw`SELECT id FROM "Pedido" WHERE id = ${id} FOR UPDATE`;
    const pedido = await tx.pedido.findUnique({ where: { id }, include: { menu: true, pago: true } });
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
    const { pago } = pedido;
    let estadoPago = pago?.estado;
    if (pago?.estado === 'APROBADO' && pago.mpPagoId) {
      // Ya estaba pagado: se devuelve el dinero. Si Mercado Pago falla, el pedido no se cancela.
      await devolverPago(pago.mpPagoId);
      logger.info({ evento: 'pago_devuelto', pedidoId: id, mpPagoId: pago.mpPagoId }, 'Pedido pagado cancelado: se devolvió');
      estadoPago = 'DEVUELTO';
    } else if (pago?.estado === 'PENDIENTE' || pago?.estado === 'RECHAZADO') {
      estadoPago = 'CANCELADO';
    }
    return tx.pedido.update({
      where: { id },
      data: { estado: 'CANCELADO', ...(pago && { pago: { update: { estado: estadoPago } } }) },
      include: { pago: true },
    });
  });
  res.json(cancelado);
});
