import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { crearApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { crearUsuario, limpiarBase } from './ayudantes';
import { MAX_IMAGEN } from '../../src/routes/menus';

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

  it('guarda la foto del plato, la conserva al editar sin mandarla y la quita con null', async () => {
    const imagen = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    const { body: creado } = await request(app).post('/api/menus').set('Authorization', cocinero).send({ ...menuValido, imagen });
    expect(creado.imagen).toBe(imagen);
    const editado = await request(app).put(`/api/menus/${creado.id}`).set('Authorization', cocinero).send(menuValido);
    expect(editado.body.imagen).toBe(imagen);
    const sinFoto = await request(app).put(`/api/menus/${creado.id}`).set('Authorization', cocinero).send({ ...menuValido, imagen: null });
    expect(sinFoto.body.imagen).toBeNull();
  });

  it('rechaza una imagen que no es JPG/PNG/WebP o que es muy pesada (400)', async () => {
    const envio = (imagen: string) => request(app).post('/api/menus').set('Authorization', cocinero).send({ ...menuValido, imagen });
    expect((await envio('data:text/html;base64,PGh0bWw+')).status).toBe(400);
    expect((await envio(`data:image/png;base64,${'A'.repeat(MAX_IMAGEN)}`)).status).toBe(400);
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
