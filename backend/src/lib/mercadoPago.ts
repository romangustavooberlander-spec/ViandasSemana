// Cliente mínimo de la API de Mercado Pago (https://api.mercadopago.com), con fetch nativo.
// Se usa Checkout Pro: el cliente paga en la página de Mercado Pago y vuelve al frontend.
import { env } from '../config/env';
import { HttpError } from './errors';
import { logger } from './logger';

const API = 'https://api.mercadopago.com';

export interface PagoMercadoPago {
  id: number;
  status: string; // approved, rejected, cancelled, pending, in_process, refunded, ...
  external_reference: string | null; // id del pedido
  transaction_amount: number;
  currency_id: string;
}

async function llamar<T>(ruta: string, metodo = 'GET', cuerpo?: unknown, claveIdempotencia?: string): Promise<T> {
  if (!env.mpAccessToken) {
    logger.error({ evento: 'mercadopago_sin_configurar' }, 'Falta MP_ACCESS_TOKEN: no se pueden procesar pagos');
    throw new HttpError(503, 'Los pagos no están disponibles en este momento');
  }
  let res: Response;
  try {
    res = await fetch(`${API}${ruta}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${env.mpAccessToken}`,
        'Content-Type': 'application/json',
        ...(claveIdempotencia ? { 'X-Idempotency-Key': claveIdempotencia } : {}),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch (err) {
    logger.error({ evento: 'mercadopago_sin_conexion', err, ruta }, 'No se pudo conectar con Mercado Pago');
    throw new HttpError(502, 'No se pudo conectar con Mercado Pago. Probá de nuevo en unos minutos');
  }
  if (!res.ok) {
    // El detalle va al log; al usuario sólo un mensaje claro, sin datos internos.
    const detalle = await res.text().catch(() => '');
    logger.error({ evento: 'mercadopago_error', status: res.status, ruta, detalle }, 'Mercado Pago respondió con error');
    if (res.status === 404) throw new HttpError(404, 'El pago no existe en Mercado Pago');
    throw new HttpError(502, 'Mercado Pago no pudo procesar la operación. Probá de nuevo en unos minutos');
  }
  return (await res.json()) as T;
}

export interface DatosPreferencia {
  pedidoId: number;
  titulo: string;
  cantidad: number;
  precioUnitario: number;
  venceEn: Date;
}

/** Crea la preferencia de Checkout Pro por el 100 % del pedido y devuelve su id y la URL de pago. */
export function crearPreferencia(d: DatosPreferencia) {
  const volver = `${env.frontendUrl}/?pedido=${d.pedidoId}`;
  return llamar<{ id: string; init_point: string }>('/checkout/preferences', 'POST', {
    items: [
      { id: `pedido-${d.pedidoId}`, title: d.titulo, quantity: d.cantidad, unit_price: d.precioUnitario, currency_id: 'ARS' },
    ],
    external_reference: String(d.pedidoId),
    back_urls: { success: volver, failure: volver, pending: volver },
    // Mercado Pago sólo acepta volver solo a una URL https (no a localhost).
    ...(volver.startsWith('https://') ? { auto_return: 'approved' } : {}),
    // Sin URL pública (en local) no hay webhook: el estado se consulta cuando el cliente vuelve.
    ...(env.apiUrl ? { notification_url: `${env.apiUrl}/api/pagos/notificacion` } : {}),
    // Pasado el plazo no se puede pagar: así no llegan pagos de reservas ya vencidas.
    expires: true,
    expiration_date_to: d.venceEn.toISOString(),
    // Sólo medios que se acreditan en el momento (sin efectivo en Rapipago/Pago Fácil ni cajero).
    payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }] },
    statement_descriptor: 'VIANDASSEMANA',
  });
}

/** Consulta el estado real de un pago. Es la única fuente de verdad: nunca se confía en el frontend. */
export const obtenerPago = (id: string) => llamar<PagoMercadoPago>(`/v1/payments/${encodeURIComponent(id)}`);

/** Busca los pagos hechos para un pedido (su external_reference). */
export const buscarPagos = (pedidoId: number) =>
  llamar<{ results: PagoMercadoPago[] }>(`/v1/payments/search?external_reference=${pedidoId}`);

/** Devuelve el total de un pago aprobado. La clave de idempotencia evita devolverlo dos veces. */
export const devolverPago = (id: string) =>
  llamar(`/v1/payments/${encodeURIComponent(id)}/refunds`, 'POST', {}, `devolucion-${id}`);
