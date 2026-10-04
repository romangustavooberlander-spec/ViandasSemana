// Tests de INTEGRACIÓN de autenticación contra la base de PRUEBAS.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { crearApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { autenticar, exigirRol } from '../../src/middleware/auth';
import { manejadorErrores } from '../../src/middleware/errorHandler';

const app = crearApp({ corsOrigins: ['http://localhost:5173'] });
const datos = { nombre: 'Ana', email: 'ana@test.com', password: 'clave1234' };

async function registrarYLoguear() {
  await request(app).post('/api/auth/registro').send(datos);
  const res = await request(app).post('/api/auth/login').send({ email: datos.email, password: datos.password });
  return res.body.token as string;
}

beforeEach(async () => {
  await prisma.pedido.deleteMany();
  await prisma.usuario.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/registro', () => {
  it('crea un CLIENTE (201) y guarda la contraseña con hash', async () => {
    const res = await request(app).post('/api/auth/registro').send(datos);
    expect(res.status).toBe(201);
    expect(res.body.rol).toBe('CLIENTE');
    expect(res.body.passwordHash).toBeUndefined();

    const guardado = await prisma.usuario.findUniqueOrThrow({ where: { email: datos.email } });
    expect(guardado.passwordHash).not.toBe(datos.password);
  });

  it('devuelve 400 con datos inválidos', async () => {
    const res = await request(app).post('/api/auth/registro').send({ email: 'no-es-email', password: '1' });
    expect(res.status).toBe(400);
  });

  it('devuelve 409 si el email ya existe', async () => {
    await request(app).post('/api/auth/registro').send(datos);
    const res = await request(app).post('/api/auth/registro').send(datos);
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('devuelve un token con credenciales correctas', async () => {
    const token = await registrarYLoguear();
    const res = await request(app).get('/api/auth/yo').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.rol).toBe('CLIENTE');
  });

  it('devuelve 401 con contraseña incorrecta', async () => {
    await request(app).post('/api/auth/registro').send(datos);
    const res = await request(app).post('/api/auth/login').send({ email: datos.email, password: 'otra-clave' });
    expect(res.status).toBe(401);
  });
});

describe('Endpoints protegidos (401)', () => {
  it('rechaza una petición sin token', async () => {
    const res = await request(app).get('/api/auth/yo');
    expect(res.status).toBe(401);
  });

  it('rechaza un token inválido', async () => {
    const res = await request(app).get('/api/auth/yo').set('Authorization', 'Bearer token-falso');
    expect(res.status).toBe(401);
  });

  it('rechaza un token vencido', async () => {
    await registrarYLoguear();
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { email: datos.email } });
    const vencido = jwt.sign({ id: usuario.id, v: 0, exp: Math.floor(Date.now() / 1000) - 60 }, 'secreto-solo-para-tests');
    const res = await request(app).get('/api/auth/yo').set('Authorization', `Bearer ${vencido}`);
    expect(res.status).toBe(401);
  });
});

describe('Control por rol (403)', () => {
  // Ruta de prueba que sólo admite al COCINERO.
  const appRol = express();
  appRol.get('/solo-cocinero', autenticar, exigirRol('COCINERO'), (_req, res) => {
    res.sendStatus(200);
  });
  appRol.use(manejadorErrores);

  it('devuelve 403 a un CLIENTE autenticado', async () => {
    const token = await registrarYLoguear();
    const res = await request(appRol).get('/solo-cocinero').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('deja pasar al COCINERO (el rol se lee de la base)', async () => {
    const token = await registrarYLoguear();
    await prisma.usuario.update({ where: { email: datos.email }, data: { rol: { connect: { nombre: 'COCINERO' } } } });
    const res = await request(appRol).get('/solo-cocinero').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/auth/logout', () => {
  it('invalida el token: después del logout responde 401', async () => {
    const token = await registrarYLoguear();
    const logout = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(logout.status).toBe(204);

    const res = await request(app).get('/api/auth/yo').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});
