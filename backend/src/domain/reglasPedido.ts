// Reglas de negocio de los pedidos. Son funciones puras (no tocan la base de datos),
// por eso se prueban con tests unitarios en milisegundos.
import { HttpError } from '../lib/errors';

// Argentina no usa horario de verano: UTC-3 todo el año.
const OFFSET_ARGENTINA_HORAS = 3;

/**
 * Devuelve el instante (en UTC) en que cierra la toma de pedidos de un menú.
 * @param fechaMenu fecha del menú (se toman año, mes y día en UTC, como la guarda la base)
 * @param horaCorte hora de corte en formato "HH:mm", hora de Argentina
 */
export function instanteDeCorte(fechaMenu: Date, horaCorte: string): Date {
  const coincidencia = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(horaCorte);
  if (!coincidencia) {
    throw new Error(`Hora de corte inválida: ${horaCorte}`);
  }
  const horas = Number(coincidencia[1]);
  const minutos = Number(coincidencia[2]);
  return new Date(
    Date.UTC(
      fechaMenu.getUTCFullYear(),
      fechaMenu.getUTCMonth(),
      fechaMenu.getUTCDate(),
      horas + OFFSET_ARGENTINA_HORAS,
      minutos,
    ),
  );
}

export function yaPasoElCorte(fechaMenu: Date, horaCorte: string, ahora: Date): boolean {
  return ahora.getTime() >= instanteDeCorte(fechaMenu, horaCorte).getTime();
}

export function cuposDisponibles(cupoMaximo: number, viandasReservadas: number): number {
  return Math.max(0, cupoMaximo - viandasReservadas);
}

export interface DatosNuevoPedido {
  cantidad: number;
  cupoMaximo: number;
  viandasReservadas: number; // suma de cantidades de pedidos ACTIVOS de ese menú
  fechaMenu: Date;
  horaCorte: string;
  ahora: Date;
}

/** Lanza HttpError 409 si el pedido no se puede aceptar. */
export function validarNuevoPedido(d: DatosNuevoPedido): void {
  if (!Number.isInteger(d.cantidad) || d.cantidad < 1) {
    throw new HttpError(409, 'La cantidad debe ser un entero mayor a cero', 'CANTIDAD_INVALIDA');
  }
  if (yaPasoElCorte(d.fechaMenu, d.horaCorte, d.ahora)) {
    throw new HttpError(
      409,
      `Ya pasó el horario de corte (${d.horaCorte}) para este menú`,
      'FUERA_DE_HORARIO',
    );
  }
  const disponibles = cuposDisponibles(d.cupoMaximo, d.viandasReservadas);
  if (d.cantidad > disponibles) {
    throw new HttpError(
      409,
      disponibles === 0
        ? 'No quedan viandas disponibles para este día'
        : `Sólo quedan ${disponibles} viandas disponibles para este día`,
      'CUPO_COMPLETO',
    );
  }
}

export interface DatosCancelacion {
  estado: 'PENDIENTE_PAGO' | 'CONFIRMADO' | 'CANCELADO';
  fechaMenu: Date;
  horaCorte: string;
  ahora: Date;
}

/** Lanza HttpError 409 si el pedido no se puede cancelar. */
export function validarCancelacion(d: DatosCancelacion): void {
  if (d.estado === 'CANCELADO') {
    throw new HttpError(409, 'El pedido ya estaba cancelado', 'YA_CANCELADO');
  }
  if (yaPasoElCorte(d.fechaMenu, d.horaCorte, d.ahora)) {
    throw new HttpError(
      409,
      'No se puede cancelar un pedido después del horario de corte',
      'FUERA_DE_HORARIO',
    );
  }
}

// ---------- Pagos ----------

// Tiempo que tiene el cliente para pagar una reserva. Mientras tanto la reserva ocupa su lugar en el cupo.
export const MINUTOS_PARA_PAGAR = 30;

/** Hasta cuándo se puede pagar un pedido: MINUTOS_PARA_PAGAR, pero nunca después del horario de corte. */
export function vencimientoDelPago(fechaMenu: Date, horaCorte: string, ahora: Date): Date {
  const limite = ahora.getTime() + MINUTOS_PARA_PAGAR * 60_000;
  return new Date(Math.min(limite, instanteDeCorte(fechaMenu, horaCorte).getTime()));
}

export type EstadoPago = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'CANCELADO' | 'DEVUELTO';

/** Traduce el "status" de un pago de Mercado Pago al estado del pago en el sistema. */
export function estadoDelPago(statusMercadoPago: string): EstadoPago {
  switch (statusMercadoPago) {
    case 'approved':
      return 'APROBADO';
    case 'rejected':
      return 'RECHAZADO';
    case 'cancelled':
      return 'CANCELADO';
    case 'refunded':
    case 'charged_back':
      return 'DEVUELTO';
    default: // pending, in_process, in_mediation, authorized
      return 'PENDIENTE';
  }
}
