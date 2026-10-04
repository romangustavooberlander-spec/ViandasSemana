// Tests UNITARIOS: prueban las reglas de negocio aisladas, sin base de datos ni HTTP.
import { describe, it, expect } from 'vitest';
import {
  instanteDeCorte,
  yaPasoElCorte,
  cuposDisponibles,
  validarNuevoPedido,
  validarCancelacion,
  vencimientoDelPago,
  estadoDelPago,
} from '../../src/domain/reglasPedido';
import { HttpError } from '../../src/lib/errors';

// Menú del lunes 12/10/2026 con corte a las 10:00 (hora Argentina) = 13:00 UTC.
const fechaMenu = new Date('2026-10-12T00:00:00.000Z');
const horaCorte = '10:00';
const antesDelCorte = new Date('2026-10-12T12:59:00.000Z'); // 09:59 AR
const justoEnElCorte = new Date('2026-10-12T13:00:00.000Z'); // 10:00 AR
const despuesDelCorte = new Date('2026-10-12T13:01:00.000Z'); // 10:01 AR

function capturarCodigo(fn: () => void): string | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof HttpError) return e.codigo;
    throw e;
  }
  return undefined;
}

describe('instanteDeCorte', () => {
  it('convierte la hora de corte de Argentina a UTC (+3 horas)', () => {
    expect(instanteDeCorte(fechaMenu, '10:00').toISOString()).toBe('2026-10-12T13:00:00.000Z');
  });

  it('rechaza una hora de corte con formato inválido', () => {
    expect(() => instanteDeCorte(fechaMenu, '25:00')).toThrow('Hora de corte inválida');
    expect(() => instanteDeCorte(fechaMenu, '9:00')).toThrow('Hora de corte inválida');
  });
});

describe('yaPasoElCorte', () => {
  it('es falso un minuto antes del corte', () => {
    expect(yaPasoElCorte(fechaMenu, horaCorte, antesDelCorte)).toBe(false);
  });

  it('es verdadero exactamente en la hora de corte', () => {
    expect(yaPasoElCorte(fechaMenu, horaCorte, justoEnElCorte)).toBe(true);
  });
});

describe('cuposDisponibles', () => {
  it('resta las viandas reservadas al cupo máximo', () => {
    expect(cuposDisponibles(20, 7)).toBe(13);
  });

  it('nunca devuelve un número negativo', () => {
    expect(cuposDisponibles(5, 8)).toBe(0);
  });
});

describe('validarNuevoPedido', () => {
  const base = { cantidad: 2, cupoMaximo: 10, viandasReservadas: 5, fechaMenu, horaCorte, ahora: antesDelCorte };

  it('acepta un pedido con cupo y antes del corte', () => {
    expect(() => validarNuevoPedido(base)).not.toThrow();
  });

  it('acepta un pedido que completa exactamente el cupo', () => {
    expect(() => validarNuevoPedido({ ...base, cantidad: 5 })).not.toThrow();
  });

  it('rechaza un pedido que supera el cupo disponible', () => {
    expect(capturarCodigo(() => validarNuevoPedido({ ...base, cantidad: 6 }))).toBe('CUPO_COMPLETO');
  });

  it('rechaza un pedido cuando el cupo ya está completo', () => {
    expect(capturarCodigo(() => validarNuevoPedido({ ...base, cantidad: 1, viandasReservadas: 10 }))).toBe(
      'CUPO_COMPLETO',
    );
  });

  it('rechaza un pedido después del horario de corte', () => {
    expect(capturarCodigo(() => validarNuevoPedido({ ...base, ahora: despuesDelCorte }))).toBe('FUERA_DE_HORARIO');
  });

  it('rechaza cantidades cero, negativas o con decimales', () => {
    expect(capturarCodigo(() => validarNuevoPedido({ ...base, cantidad: 0 }))).toBe('CANTIDAD_INVALIDA');
    expect(capturarCodigo(() => validarNuevoPedido({ ...base, cantidad: -1 }))).toBe('CANTIDAD_INVALIDA');
    expect(capturarCodigo(() => validarNuevoPedido({ ...base, cantidad: 1.5 }))).toBe('CANTIDAD_INVALIDA');
  });

  it('responde con código HTTP 409', () => {
    try {
      validarNuevoPedido({ ...base, cantidad: 99 });
    } catch (e) {
      expect((e as HttpError).status).toBe(409);
      return;
    }
    throw new Error('Debió lanzar error');
  });
});

describe('validarCancelacion', () => {
  it('permite cancelar un pedido activo antes del corte', () => {
    expect(() =>
      validarCancelacion({ estado: 'CONFIRMADO', fechaMenu, horaCorte, ahora: antesDelCorte }),
    ).not.toThrow();
  });

  it('no permite cancelar después del corte', () => {
    expect(
      capturarCodigo(() => validarCancelacion({ estado: 'CONFIRMADO', fechaMenu, horaCorte, ahora: despuesDelCorte })),
    ).toBe('FUERA_DE_HORARIO');
  });

  it('no permite cancelar un pedido ya cancelado', () => {
    expect(
      capturarCodigo(() => validarCancelacion({ estado: 'CANCELADO', fechaMenu, horaCorte, ahora: antesDelCorte })),
    ).toBe('YA_CANCELADO');
  });
});

describe('vencimientoDelPago', () => {
  it('da 30 minutos para pagar', () => {
    const ahora = new Date('2026-10-12T10:00:00.000Z');
    expect(vencimientoDelPago(fechaMenu, horaCorte, ahora).toISOString()).toBe('2026-10-12T10:30:00.000Z');
  });

  it('nunca vence después del horario de corte', () => {
    expect(vencimientoDelPago(fechaMenu, horaCorte, antesDelCorte).toISOString()).toBe('2026-10-12T13:00:00.000Z');
  });
});

describe('estadoDelPago', () => {
  it('traduce los estados de Mercado Pago', () => {
    expect(estadoDelPago('approved')).toBe('APROBADO');
    expect(estadoDelPago('rejected')).toBe('RECHAZADO');
    expect(estadoDelPago('cancelled')).toBe('CANCELADO');
    expect(estadoDelPago('refunded')).toBe('DEVUELTO');
    expect(estadoDelPago('charged_back')).toBe('DEVUELTO');
    expect(estadoDelPago('in_process')).toBe('PENDIENTE');
    expect(estadoDelPago('pending')).toBe('PENDIENTE');
  });
});
