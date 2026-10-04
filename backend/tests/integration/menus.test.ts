import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { crearApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { crearUsuario, limpiarBase } from './ayudantes';

const app = crearApp({ corsOrigins: [] });
const menuValido = { fecha: '2099-01-10', descripcion: 'Milanesa con puré', cupoMaximo: 20, horaCorte: '10:00', precio: 3500 };

let cocinero: string;
let cliente: string;

beforeEach(async () => {
  await limpiarBase();
  cocinero = (await crearUsuario('COCINERO')).auth;
  cliente = (await crearUsuario('CLIENTE')).auth;
});

afterAll(() => prisma.$disconnect());

describe('API de menús', () => {
  it('POST crea un menú y responde 201', async () => {
    const res = await request(app).post('/api/menus').set('Authorization', cocinero).send(menuValido);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ descripcion: 'Milanesa con puré', reservadas: 0, disponibles: 20 });
  });

  it('GET lista los menús y GET /:id devuelve uno', async () => {
    const { body: creado } = await request(app).post('/api/menus').set('Authorization', cocinero).send(menuValido);
    const lista = await request(app).get('/api/menus').set('Authorization', cliente);
    expect(lista.status).toBe(200);
    expect(lista.body).toHaveLength(1);
    const uno = await request(app).get(`/api/menus/${creado.id}`).set('Authorization', cliente);
    expect(uno.status).toBe(200);
    expect(uno.body.id).toBe(creado.id);
  });

  it('PUT modifica un menú', async () => {
    const { body: creado } = await request(app).post('/api/menus').set('Authorization', cocinero).send(menuValido);
    const res = await request(app)
      .put(`/api/menus/${creado.id}`)
      .set('Authorization', cocinero)
      .send({ ...menuValido, cupoMaximo: 5 });
    expect(res.status).toBe(200);
    expect(res.body.cupoMaximo).toBe(5);
  });

  it('DELETE elimina un menú', async () => {
    const { body: creado } = await request(app).post('/api/menus').set('Authorization', cocinero).send(menuValido);
    const res = await request(app).delete(`/api/menus/${creado.id}`).set('Authorization', cocinero);
    expect(res.status).toBe(204);
    expect(await prisma.menuDia.count()).toBe(0);
  });

  it('no deja borrar un menú con pedidos (409)', async () => {
    const { body: menu } = await request(app).post('/api/menus').set('Authorization', cocinero).send(menuValido);
    await request(app).post('/api/pedidos').set('Authorization', cliente).send({ menuId: menu.id, cantidad: 1 });
    const res = await request(app).delete(`/api/menus/${menu.id}`).set('Authorization', cocinero);
    expect(res.status).toBe(409);
  });

  it('no deja crear dos menús para la misma fecha (409)', async () => {
    await request(app).post('/api/menus').set('Authorization', cocinero).send(menuValido);
    const res = await request(app).post('/api/menus').set('Authorization', cocinero).send(menuValido);
    expect(res.status).toBe(409);
  });

  it('responde 400 con datos inválidos', async () => {
    const res = await request(app)
      .post('/api/menus')
      .set('Authorization', cocinero)
      .send({ ...menuValido, cupoMaximo: 0, horaCorte: '25:00' });
    expect(res.status).toBe(400);
  });

  it('responde 404 si el menú no existe', async () => {
    const res = await request(app).get('/api/menus/999999').set('Authorization', cliente);
    expect(res.status).toBe(404);
  });

  it('responde 401 sin token', async () => {
    const res = await request(app).get('/api/menus');
    expect(res.status).toBe(401);
  });

  it('responde 403 si un cliente intenta crear un menú', async () => {
    const res = await request(app).post('/api/menus').set('Authorization', cliente).send(menuValido);
    expect(res.status).toBe(403);
  });
});
