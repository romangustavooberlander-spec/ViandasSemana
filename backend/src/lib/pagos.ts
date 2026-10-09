// Estado de las reservas según sus pagos. Mercado Pago es la fuente de verdad: el estado
// de un pago siempre se consulta a su API, nunca se toma de lo que mande el frontend.
import type { Prisma } from '@prisma/client';
import { estadoDelPago } from '../domain/reglasPedido';
import { HttpError } from './errors';
import { logger } from './logger';
import { buscarPagos, devolverPago, obtenerPago } from './mercadoPago';
import { prisma } from './prisma';

// Una reserva ocupa lugar en el cupo mientras espera el pago y cuando ya está pagada.
export const OCUPAN_CUPO = { in: ['PENDIENTE_PAGO' as const, 'CONFIRMADO' as const] };

/**
 * Confirma las reservas pendientes que ya tienen un pago aprobado en Mercado Pago. Hace falta
 * cuando el cliente pagó pero no volvió a la app: en local Mercado Pago no muestra el botón
 * para volver ni puede llegar al webhook. Si Mercado Pago no responde, se sigue sin cambios.
 */
export async function sincronizarPendientes(where: Prisma.PedidoWhereInput) {
  const pendientes = await prisma.pedido.findMany({ where: { ...where, estado: 'PENDIENTE_PAGO' }, select: { id: true } });
  for (const { id } of pendientes) {
    try {
      const { results } = await buscarPagos(id);
      const aprobado = results.find((p) => p.status === 'approved');
      if (aprobado) await procesarPago(String(aprobado.id));
    } catch (err) {
      logger.warn({ evento: 'sincronizar_pago_fallo', pedidoId: id, err }, 'No se pudo consultar el pago en Mercado Pago');
    }
  }
}

/** Cancela las reservas cuyo plazo para pagar ya pasó: liberan su lugar en el cupo. */
export async function vencerReservasImpagas(db: Prisma.TransactionClient = prisma) {
  const ahora = new Date();
  await db.pago.updateMany({
    where: { estado: 'PENDIENTE', venceEn: { lte: ahora }, pedido: { estado: 'PENDIENTE_PAGO' } },
    data: { estado: 'CANCELADO' },
  });
  await db.pedido.updateMany({
    where: { estado: 'PENDIENTE_PAGO', pago: { venceEn: { lte: ahora } } },
    data: { estado: 'CANCELADO' },
  });
}

/**
 * Actualiza la reserva según el estado real de un pago de Mercado Pago.
 * Lo usan el webhook y el frontend cuando el cliente vuelve de pagar; repetirlo no cambia nada.
 */
export async function procesarPago(mpPagoId: string) {
  const pagoMp = await obtenerPago(mpPagoId);
  const pedidoId = Number(pagoMp.external_reference);
  const id = String(pagoMp.id);
  const estado = estadoDelPago(pagoMp.status);

  return prisma.$transaction(async (tx) => {
    // Bloquea el pedido: si llegan dos avisos del mismo pago a la vez, se procesan de a uno.
    const bloqueado = Number.isInteger(pedidoId)
      ? await tx.$queryRaw<unknown[]>`SELECT id FROM "Pedido" WHERE id = ${pedidoId} FOR UPDATE`
      : [];
    const pedido = bloqueado.length ? await tx.pedido.findUnique({ where: { id: pedidoId }, include: { pago: true } }) : null;
    if (!pedido?.pago) throw new HttpError(404, 'El pago no corresponde a ninguna reserva');
    const { pago } = pedido;
    const resultado = () => tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: { pago: true } });

    // Aviso repetido: ya está procesado.
    if (pago.mpPagoId === id && pago.estado === estado) return resultado();

    if (estado === 'APROBADO') {
      const montoCorrecto = pagoMp.transaction_amount === pago.monto && pagoMp.currency_id === 'ARS';
      if (pedido.estado === 'PENDIENTE_PAGO' && montoCorrecto) {
        await tx.pago.update({ where: { id: pago.id }, data: { estado: 'APROBADO', mpPagoId: id } });
        await tx.pedido.update({ where: { id: pedidoId }, data: { estado: 'CONFIRMADO' } });
        logger.info({ evento: 'pago_aprobado', pedidoId, mpPagoId: id }, 'Reserva pagada y confirmada');
        return resultado();
      }
      // Se pagó una reserva que ya estaba cancelada o vencida, o se pagó dos veces: se devuelve el dinero.
      await devolverPago(id);
      logger.warn({ evento: 'pago_devuelto', pedidoId, mpPagoId: id, montoCorrecto }, 'Pago no esperado: se devolvió');
      if (pedido.estado !== 'CONFIRMADO') {
        await tx.pago.update({ where: { id: pago.id }, data: { estado: 'DEVUELTO', mpPagoId: id } });
      }
      return resultado();
    }

    if (pedido.estado === 'PENDIENTE_PAGO') {
      // Pendiente, rechazado o cancelado: la reserva NO se confirma. Puede reintentar el pago hasta que venza.
      await tx.pago.update({ where: { id: pago.id }, data: { estado, mpPagoId: id } });
    } else if (pedido.estado === 'CONFIRMADO' && pago.mpPagoId === id && estado === 'DEVUELTO') {
      // El pago se devolvió desde Mercado Pago (o hubo un contracargo): la reserva deja de valer.
      await tx.pago.update({ where: { id: pago.id }, data: { estado: 'DEVUELTO' } });
      await tx.pedido.update({ where: { id: pedidoId }, data: { estado: 'CANCELADO' } });
    }
    return resultado();
  });
}
