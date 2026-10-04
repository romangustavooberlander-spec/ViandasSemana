import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { crearApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { crearUsuario, limpiarBase } from './ayudantes';

const app = crearApp({ corsOrigins: [] });

let cocinero: string;
let cliente: string;
let menuAbierto: number; // fecha futura: todavía se puede pedir
let menuCerrado: number; // fecha pasada: ya pasó el horario de corte

beforeEach(async () => {
  await limpiarBase();
  cocinero = (await crearUsuario('COCINERO')).auth;
  cliente = (await crearUsuario('CLIENTE')).auth;
  const datos = { descripcion: 'Tarta', cupoMaximo: 3, horaCorte: '10:00' };
  menuAbierto = (await prisma.menuDia.create({ data: { ...datos, fecha: new Date('2099-01-10') } })).id;
  menuCerrado = (await prisma.menuDia.create({ data: { ...datos, fecha: new Date('2000-01-10') } })).id;
});

afterAll(() => prisma.$disconnect());

const pedir = (auth: string, menuId: number, cantidad: number) =>
  request(app).post('/api/pedidos').set('Authorization', auth).send({ menuId, cantidad });

describe('API de pedidos', () => {
  it('POST crea un pedido y responde 201', async () => {
    const res = await pedir(cliente, menuAbierto, 2);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ menuId: menuAbierto, cantidad: 2, estado: 'ACTIVO' });
  });

  it('rechaza un pedido que supera el cupo (409 CUPO_COMPLETO)', async () => {
    await pedir(cliente, menuAbierto, 2);
    const res = await pedir(cliente, menuAbierto, 2);
    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('CUPO_COMPLETO');
  });

  it('rechaza un pedido después del horario de corte (409 FUERA_DE_HORARIO)', async () => {
    const res = await pedir(cliente, menuCerrado, 1);
    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('FUERA_DE_HORARIO');
  });

  it('pedidos simultáneos nunca superan el cupo', async () => {
    const respuestas = await Promise.all(Array.from({ length: 6 }, () => pedir(cliente, menuAbierto, 1)));
    expect(respuestas.filter((r) => r.status === 201)).toHaveLength(3);
    expect(respuestas.filter((r) => r.status === 409)).toHaveLength(3);
    const { _sum } = await prisma.pedido.aggregate({ where: { menuId: menuAbierto }, _sum: { cantidad: true } });
    expect(_sum.cantidad).toBe(3);
  });

  it('responde 400 con datos inválidos y 404 si el menú no existe', async () => {
    expect((await pedir(cliente, menuAbierto, 0)).status).toBe(400);
    expect((await pedir(cliente, 999999, 1)).status).toBe(404);
  });

  it('responde 403 si el cocinero intenta pedir', async () => {
    expect((await pedir(cocinero, menuAbierto, 1)).status).toBe(403);
  });

  it('GET: el cliente ve sólo sus pedidos y el cocinero ve todos', async () => {
    const otro = (await crearUsuario('CLIENTE', 'otro@test.com')).auth;
    await pedir(cliente, menuAbierto, 1);
    await pedir(otro, menuAbierto, 1);
    const propios = await request(app).get('/api/pedidos').set('Authorization', cliente);
    expect(propios.status).toBe(200);
    expect(propios.body).toHaveLength(1);
    expect(propios.body[0].cancelable).toBe(true);
    const todos = await request(app).get('/api/pedidos').set('Authorization', cocinero);
    expect(todos.body).toHaveLength(2);
  });

  it('el cocinero ve el total de viandas a preparar en el menú', async () => {
    await pedir(cliente, menuAbierto, 2);
    const res = await request(app).get(`/api/menus/${menuAbierto}`).set('Authorization', cocinero);
    expect(res.body).toMatchObject({ reservadas: 2, disponibles: 1, abierto: true });
    const cerrado = await request(app).get(`/api/menus/${menuCerrado}`).set('Authorization', cocinero);
    expect(cerrado.body.abierto).toBe(false);
  });

  it('PATCH cancela un pedido propio y libera el cupo', async () => {
    const { body: pedido } = await pedir(cliente, menuAbierto, 3);
    const res = await request(app).patch(`/api/pedidos/${pedido.id}/cancelar`).set('Authorization', cliente);
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('CANCELADO');
    expect((await pedir(cliente, menuAbierto, 3)).status).toBe(201);
  });

  it('no deja cancelar dos veces (409) ni un pedido ajeno (404)', async () => {
    const { body: pedido } = await pedir(cliente, menuAbierto, 1);
    const cancelar = (auth: string) =>
      request(app).patch(`/api/pedidos/${pedido.id}/cancelar`).set('Authorization', auth);
    const otro = (await crearUsuario('CLIENTE', 'otro@test.com')).auth;
    expect((await cancelar(otro)).status).toBe(404);
    await cancelar(cliente);
    expect((await cancelar(cliente)).status).toBe(409);
  });

  it('no deja cancelar después del horario de corte (409)', async () => {
    const { id: usuarioId } = await prisma.usuario.findFirstOrThrow({ where: { email: 'cliente@test.com' } });
    const pedido = await prisma.pedido.create({ data: { menuId: menuCerrado, usuarioId, cantidad: 1 } });
    const res = await request(app).patch(`/api/pedidos/${pedido.id}/cancelar`).set('Authorization', cliente);
    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('FUERA_DE_HORARIO');
  });
});
