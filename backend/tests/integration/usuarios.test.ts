// Tests de INTEGRACIÓN de la administración de usuarios (rol ADMINISTRADOR) contra la base de PRUEBAS.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { crearApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { crearUsuario, limpiarBase } from './ayudantes';

const app = crearApp({ corsOrigins: ['http://localhost:5173'] });

beforeEach(limpiarBase);
afterAll(async () => {
  await prisma.$disconnect();
});

async function loginAdmin() {
  const res = await request(app).post('/api/auth/login').send({ email: 'admin', password: 'admin' });
  return `Bearer ${res.body.token}`;
}

describe('cuenta admin creada por la migración', () => {
  it('ingresa con usuario "admin" y contraseña "admin"', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin', password: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.usuario.rol).toBe('ADMINISTRADOR');
  });

  it('rechaza una contraseña incorrecta (401)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin', password: 'otra' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/usuarios', () => {
  it('el administrador ve todos los usuarios con su rol, sin contraseñas', async () => {
    await crearUsuario('CLIENTE');
    const res = await request(app).get('/api/usuarios').set('Authorization', await loginAdmin());
    expect(res.status).toBe(200);
    expect(res.body.map((u: { email: string; rol: string }) => [u.email, u.rol])).toEqual(
      expect.arrayContaining([
        ['admin', 'ADMINISTRADOR'],
        ['cliente@test.com', 'CLIENTE'],
      ]),
    );
    expect(res.body[0]).not.toHaveProperty('passwordHash');
  });

  it('un cliente o un cocinero no pueden (403) y sin token es 401', async () => {
    const { auth: cliente } = await crearUsuario('CLIENTE');
    const { auth: cocinero } = await crearUsuario('COCINERO');
    expect((await request(app).get('/api/usuarios').set('Authorization', cliente)).status).toBe(403);
    expect((await request(app).get('/api/usuarios').set('Authorization', cocinero)).status).toBe(403);
    expect((await request(app).get('/api/usuarios')).status).toBe(401);
  });
});

describe('PATCH /api/usuarios/:id/rol', () => {
  it('hace cocinero a un cliente y después lo vuelve a cliente', async () => {
    const admin = await loginAdmin();
    const { usuario, auth } = await crearUsuario('CLIENTE');

    const res = await request(app).patch(`/api/usuarios/${usuario.id}/rol`).set('Authorization', admin).send({ rol: 'COCINERO' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: usuario.id, rol: 'COCINERO' });
    // El cambio vale enseguida: el rol se lee de la base en cada pedido.
    expect((await request(app).get('/api/auth/yo').set('Authorization', auth)).body.rol).toBe('COCINERO');

    const vuelta = await request(app).patch(`/api/usuarios/${usuario.id}/rol`).set('Authorization', admin).send({ rol: 'CLIENTE' });
    expect(vuelta.body.rol).toBe('CLIENTE');
  });

  it('no permite dar el rol ADMINISTRADOR ni un rol inexistente (400)', async () => {
    const { usuario } = await crearUsuario('CLIENTE');
    const admin = await loginAdmin();
    for (const rol of ['ADMINISTRADOR', 'JEFE']) {
      const res = await request(app).patch(`/api/usuarios/${usuario.id}/rol`).set('Authorization', admin).send({ rol });
      expect(res.status).toBe(400);
    }
  });

  it('no permite cambiar el rol de un administrador (400)', async () => {
    const admin = await loginAdmin();
    const { id } = await prisma.usuario.findUniqueOrThrow({ where: { email: 'admin' } });
    const res = await request(app).patch(`/api/usuarios/${id}/rol`).set('Authorization', admin).send({ rol: 'CLIENTE' });
    expect(res.status).toBe(400);
  });

  it('responde 404 si el usuario no existe y 403 si no es administrador', async () => {
    const admin = await loginAdmin();
    const res = await request(app).patch('/api/usuarios/999999/rol').set('Authorization', admin).send({ rol: 'COCINERO' });
    expect(res.status).toBe(404);

    const { usuario, auth } = await crearUsuario('COCINERO');
    const prohibido = await request(app).patch(`/api/usuarios/${usuario.id}/rol`).set('Authorization', auth).send({ rol: 'CLIENTE' });
    expect(prohibido.status).toBe(403);
  });
});
