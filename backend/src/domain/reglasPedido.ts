// Reglas de negocio de los pedidos. Son funciones puras (no tocan la base de datos),
// por eso se prueban con tests unitarios en milisegundos.
import { ReglaNegocioError } from '../lib/errors';

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

/** Lanza ReglaNegocioError si el pedido no se puede aceptar. */
export function validarNuevoPedido(d: DatosNuevoPedido): void {
  if (!Number.isInteger(d.cantidad) || d.cantidad < 1) {
    throw new ReglaNegocioError('CANTIDAD_INVALIDA', 'La cantidad debe ser un entero mayor a cero');
  }
  if (yaPasoElCorte(d.fechaMenu, d.horaCorte, d.ahora)) {
    throw new ReglaNegocioError(
      'FUERA_DE_HORARIO',
      `Ya pasó el horario de corte (${d.horaCorte}) para este menú`,
    );
  }
  const disponibles = cuposDisponibles(d.cupoMaximo, d.viandasReservadas);
  if (d.cantidad > disponibles) {
    throw new ReglaNegocioError(
      'CUPO_COMPLETO',
      disponibles === 0
        ? 'No quedan viandas disponibles para este día'
        : `Sólo quedan ${disponibles} viandas disponibles para este día`,
    );
  }
}

export interface DatosCancelacion {
  estado: 'ACTIVO' | 'CANCELADO';
  fechaMenu: Date;
  horaCorte: string;
  ahora: Date;
}

/** Lanza ReglaNegocioError si el pedido no se puede cancelar. */
export function validarCancelacion(d: DatosCancelacion): void {
  if (d.estado === 'CANCELADO') {
    throw new ReglaNegocioError('YA_CANCELADO', 'El pedido ya estaba cancelado');
  }
  if (yaPasoElCorte(d.fechaMenu, d.horaCorte, d.ahora)) {
    throw new ReglaNegocioError(
      'FUERA_DE_HORARIO',
      'No se puede cancelar un pedido después del horario de corte',
    );
  }
}
