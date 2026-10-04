import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { crearApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { crearUsuario, limpiarBase, simularMercadoPago } from './ayudantes';

const app = crearApp({ corsOrigins: [] });

let cliente: string;
let menuId: number;
let mp: ReturnType<typeof simularMercadoPago>;

beforeEach(async () => {
  await limpiarBase();
  mp = simularMercadoPago();
  cliente = (await crearUsuario('CLIENTE')).auth;
  const menu = { descripcion: 'Tarta', cupoMaximo: 3, horaCorte: '10:00', precio: 3000, fecha: new Date('2099-01-10') };
  menuId = (await prisma.menuDia.create({ data: menu })).id;
});

afterAll(() => prisma.$disconnect());

const reservar = (cantidad = 2) =>
  request(app).post('/api/pedidos').set('Authorization', cliente).send({ menuId, cantidad });
const notificar = (id: string) =>
  request(app).post('/api/pagos/notificacion').send({ type: 'payment', data: { id } });
const leer = (id: number) => prisma.pedido.findUniqueOrThrow({ where: { id }, include: { pago: true } });

describe('Reserva y pago con Mercado Pago', () => {
  it('la reserva nace pendiente, con su pago por el 100 % y la URL de Mercado Pago', async () => {
    const res = await reservar(2);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ estado: 'PENDIENTE_PAGO', urlPago: `https://mp.test/pagar/${res.body.id}` });
    expect(res.body.pago).toMatchObject({ monto: 6000, estado: 'PENDIENTE', preferenciaId: `pref-${res.body.id}` });
    expect(mp.preferencias[0]).toMatchObject({
      external_reference: String(res.body.id),
      items: [{ quantity: 2, unit_price: 3000, currency_id: 'ARS' }],
      expires: true,
    });
  });

  it('confirma la reserva sólo cuando Mercado Pago aprueba el pago', async () => {
    const { body: pedido } = await reservar();
    const id = await mp.pagar(pedido.id, 'approved');
    const res = await notificar(id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estadoPedido: 'CONFIRMADO', estadoPago: 'APROBADO' });
    expect((await leer(pedido.id)).pago).toMatchObject({ estado: 'APROBADO', mpPagoId: id });
    // El aviso repetido no cambia nada.
    expect((await notificar(id)).body.estadoPedido).toBe('CONFIRMADO');
    const lista = await request(app).get('/api/pedidos').set('Authorization', cliente);
    expect(lista.body[0]).toMatchObject({ estado: 'CONFIRMADO', pagable: false, cancelable: true });
  });

  it('un pago rechazado no confirma la reserva y se puede reintentar', async () => {
    const { body: pedido } = await reservar();
    await notificar(await mp.pagar(pedido.id, 'rejected'));
    expect(await leer(pedido.id)).toMatchObject({ estado: 'PENDIENTE_PAGO', pago: { estado: 'RECHAZADO' } });
    const reintento = await request(app).post(`/api/pedidos/${pedido.id}/pagar`).set('Authorization', cliente);
    expect(reintento.body.urlPago).toBe(`https://mp.test/pagar/${pedido.id}`);
    await notificar(await mp.pagar(pedido.id, 'approved'));
    expect((await leer(pedido.id)).estado).toBe('CONFIRMADO');
  });

  it('un pago cancelado o pendiente tampoco confirma la reserva', async () => {
    const { body: pedido } = await reservar();
    await notificar(await mp.pagar(pedido.id, 'in_process'));
    expect((await leer(pedido.id)).pago?.estado).toBe('PENDIENTE');
    await notificar(await mp.pagar(pedido.id, 'cancelled'));
    expect(await leer(pedido.id)).toMatchObject({ estado: 'PENDIENTE_PAGO', pago: { estado: 'CANCELADO' } });
  });

  it('acepta el aviso con los datos en la URL e ignora otros tipos de aviso', async () => {
    const { body: pedido } = await reservar();
    const id = await mp.pagar(pedido.id);
    const res = await request(app).post(`/api/pagos/notificacion?type=payment&data.id=${id}`);
    expect(res.body.estadoPedido).toBe('CONFIRMADO');
    expect((await request(app).post('/api/pagos/notificacion').send({ type: 'merchant_order' })).body).toEqual({ ignorado: true });
  });

  it('responde 404 si el pago no existe y 400 si el id es inválido', async () => {
    expect((await notificar('999')).status).toBe(404);
    expect((await notificar('abc')).status).toBe(400);
  });

  it('si el monto no coincide no confirma y devuelve el dinero', async () => {
    const { body: pedido } = await reservar();
    const id = await mp.pagar(pedido.id, 'approved', '555', 1);
    await notificar(id);
    expect(await leer(pedido.id)).toMatchObject({ estado: 'PENDIENTE_PAGO', pago: { estado: 'DEVUELTO' } });
    expect(mp.devoluciones).toEqual(['555']);
  });

  it('si se paga una reserva ya cancelada, devuelve el dinero', async () => {
    const { body: pedido } = await reservar();
    await request(app).patch(`/api/pedidos/${pedido.id}/cancelar`).set('Authorization', cliente);
    const id = await mp.pagar(pedido.id);
    await notificar(id);
    expect(await leer(pedido.id)).toMatchObject({ estado: 'CANCELADO', pago: { estado: 'DEVUELTO' } });
    expect(mp.devoluciones).toEqual([id]);
  });

  it('cancelar una reserva pagada devuelve el dinero', async () => {
    const { body: pedido } = await reservar();
    const id = await mp.pagar(pedido.id);
    await notificar(id);
    const res = await request(app).patch(`/api/pedidos/${pedido.id}/cancelar`).set('Authorization', cliente);
    expect(res.body).toMatchObject({ estado: 'CANCELADO', pago: { estado: 'DEVUELTO' } });
    expect(mp.devoluciones).toEqual([id]);
    // Si después Mercado Pago avisa la devolución, no cambia nada.
    await mp.pagar(pedido.id, 'refunded', id);
    expect((await notificar(id)).body.estadoPago).toBe('DEVUELTO');
  });

  it('una devolución hecha desde Mercado Pago cancela la reserva confirmada', async () => {
    const { body: pedido } = await reservar();
    const id = await mp.pagar(pedido.id);
    await notificar(id);
    await mp.pagar(pedido.id, 'refunded', id);
    await notificar(id);
    expect(await leer(pedido.id)).toMatchObject({ estado: 'CANCELADO', pago: { estado: 'DEVUELTO' } });
  });

  it('una reserva sin pagar vence y libera el cupo', async () => {
    const { body: pedido } = await reservar(3);
    expect((await reservar(1)).body.codigo).toBe('CUPO_COMPLETO');
    await prisma.pago.update({ where: { pedidoId: pedido.id }, data: { venceEn: new Date(Date.now() - 1000) } });
    expect((await reservar(1)).status).toBe(201);
    expect(await leer(pedido.id)).toMatchObject({ estado: 'CANCELADO', pago: { estado: 'CANCELADO' } });
    const pagar = await request(app).post(`/api/pedidos/${pedido.id}/pagar`).set('Authorization', cliente);
    expect(pagar.status).toBe(409);
    expect(pagar.body.codigo).toBe('NO_PAGABLE');
  });

  it('no deja pagar un pedido ajeno ni uno ya pagado', async () => {
    const { body: pedido } = await reservar();
    const otro = (await crearUsuario('CLIENTE', 'otro@test.com')).auth;
    expect((await request(app).post(`/api/pedidos/${pedido.id}/pagar`).set('Authorization', otro)).status).toBe(404);
    await notificar(await mp.pagar(pedido.id));
    const res = await request(app).post(`/api/pedidos/${pedido.id}/pagar`).set('Authorization', cliente);
    expect(res.body).toMatchObject({ codigo: 'NO_PAGABLE', error: 'Este pedido ya está pagado' });
  });

  it('si Mercado Pago falla al crear el pago, la reserva se cancela y libera el cupo', async () => {
    mp.estado.fallarPreferencia = true;
    const res = await reservar(3);
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/Mercado Pago/);
    expect(await prisma.pedido.findFirst()).toMatchObject({ estado: 'CANCELADO' });
    mp.estado.fallarPreferencia = false;
    expect((await reservar(3)).status).toBe(201);
  });

  it('no deja reservar un menú sin precio', async () => {
    await prisma.menuDia.update({ where: { id: menuId }, data: { precio: 0 } });
    const res = await reservar();
    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('SIN_PRECIO');
  });
});
