// Utilidades compartidas por los tests de integración. Usan la base de PRUEBAS.
// Los roles los crea la migración inicial, por eso no se borran.
import jwt from 'jsonwebtoken';
import { vi } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import type { PagoMercadoPago } from '../../src/lib/mercadoPago';

export async function limpiarBase() {
  await prisma.pago.deleteMany();
  await prisma.pedido.deleteMany();
  await prisma.menuDia.deleteMany();
  await prisma.codigoRecuperacion.deleteMany();
  await prisma.usuario.deleteMany();
}

// Crea un usuario con el rol pedido y devuelve el encabezado Authorization listo para usar.
export async function crearUsuario(rol: 'COCINERO' | 'CLIENTE', email = `${rol.toLowerCase()}@test.com`) {
  const usuario = await prisma.usuario.create({
    data: { email, nombre: rol, passwordHash: 'x', rol: { connect: { nombre: rol } } },
  });
  const token = jwt.sign({ id: usuario.id, v: usuario.versionToken }, process.env.JWT_SECRET!);
  return { usuario, auth: `Bearer ${token}` };
}

/**
 * Reemplaza fetch por una versión falsa de la API de Mercado Pago (los tests no salen a internet).
 * - POST /checkout/preferences crea una preferencia (o falla si `fallarPreferencia`).
 * - GET /v1/payments/:id devuelve el pago cargado en `pagos` (404 si no está).
 * - POST /v1/payments/:id/refunds registra la devolución.
 */
export function simularMercadoPago() {
  const pagos = new Map<string, PagoMercadoPago>();
  const preferencias: any[] = [];
  const devoluciones: string[] = [];
  const estado = { fallarPreferencia: false };
  const responder = (status: number, cuerpo: unknown) =>
    new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, opciones: RequestInit = {}) => {
      const ruta = new URL(url).pathname;
      if (ruta === '/checkout/preferences') {
        if (estado.fallarPreferencia) return responder(500, { message: 'error interno' });
        const cuerpo = JSON.parse(String(opciones.body));
        preferencias.push(cuerpo);
        return responder(201, { id: `pref-${cuerpo.external_reference}`, init_point: `https://mp.test/pagar/${cuerpo.external_reference}` });
      }
      const devolucion = /^\/v1\/payments\/(\w+)\/refunds$/.exec(ruta);
      if (devolucion) {
        devoluciones.push(devolucion[1]);
        return responder(201, { id: 1, status: 'approved' });
      }
      const pago = pagos.get(ruta.replace('/v1/payments/', ''));
      return pago ? responder(200, pago) : responder(404, { message: 'not found' });
    }),
  );

  // Carga un pago "real" de Mercado Pago para un pedido. Por defecto, aprobado y por el monto correcto.
  async function pagar(pedidoId: number, status = 'approved', id = String(1000 + pagos.size), monto?: number) {
    const { monto: correcto } = await prisma.pago.findUniqueOrThrow({ where: { pedidoId } });
    pagos.set(id, {
      id: Number(id),
      status,
      external_reference: String(pedidoId),
      transaction_amount: monto ?? correcto,
      currency_id: 'ARS',
    });
    return id;
  }

  return { pagar, preferencias, devoluciones, estado };
}
