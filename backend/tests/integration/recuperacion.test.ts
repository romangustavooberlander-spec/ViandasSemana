import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { crearApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { HttpError } from '../../src/lib/errors';
import { enviarCorreo } from '../../src/lib/mailer';
import { limpiarBase } from './ayudantes';

// El correo no se manda de verdad: se captura para leer el código.
vi.mock('../../src/lib/mailer', () => ({ enviarCorreo: vi.fn() }));
const correo = vi.mocked(enviarCorreo);

const app = crearApp({ corsOrigins: [] });
const email = 'ana@test.com';

beforeEach(async () => {
  await limpiarBase();
  correo.mockReset();
  await request(app).post('/api/auth/registro').send({ nombre: 'Ana', email, password: 'vieja1234' });
});

afterAll(() => prisma.$disconnect());

const pedirCodigo = (mail = email) => request(app).post('/api/auth/recuperar').send({ email: mail });
const verificar = (codigo: string) => request(app).post('/api/auth/recuperar/verificar').send({ email, codigo });
const cambiar = (codigo: string, password = 'nueva1234') =>
  request(app).post('/api/auth/recuperar/cambiar').send({ email, codigo, password });
const ultimoCodigo = () => /: (\d{6})\n/.exec(correo.mock.calls.at(-1)![2])![1];
const login = (password: string) => request(app).post('/api/auth/login').send({ email, password });

describe('Recuperación de contraseña', () => {
  it('flujo completo: pide el código, lo verifica y cambia la contraseña', async () => {
    const { body: sesion } = await login('vieja1234');
    const res = await pedirCodigo();
    expect(res.status).toBe(200);
    expect(correo).toHaveBeenCalledOnce();
    expect(correo.mock.calls[0][0]).toBe(email);
    const codigo = ultimoCodigo();
    // En la base no queda ni el código ni la contraseña en texto plano.
    const guardado = await prisma.codigoRecuperacion.findFirstOrThrow();
    expect(guardado.codigoHash).not.toContain(codigo);

    expect((await verificar(codigo)).status).toBe(200);
    expect((await cambiar(codigo)).status).toBe(200);

    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { email } });
    expect(usuario.passwordHash).not.toBe('nueva1234');
    expect(await bcrypt.compare('nueva1234', usuario.passwordHash)).toBe(true);
    expect((await login('nueva1234')).status).toBe(200);
    expect((await login('vieja1234')).status).toBe(401);
    // Las sesiones abiertas antes del cambio se cierran.
    expect((await request(app).get('/api/auth/yo').set('Authorization', `Bearer ${sesion.token}`)).status).toBe(401);
    // El código es de un solo uso.
    const otraVez = await cambiar(codigo, 'otra12345');
    expect(otraVez.status).toBe(400);
    expect(otraVez.body.codigo).toBe('CODIGO_USADO');
  });

  it('responde lo mismo si el email no existe, pero no manda correo', async () => {
    const existe = await pedirCodigo();
    const noExiste = await pedirCodigo('nadie@test.com');
    expect(noExiste.status).toBe(200);
    expect(noExiste.body).toEqual(existe.body);
    expect(correo).toHaveBeenCalledOnce();
    expect((await request(app).post('/api/auth/recuperar/verificar').send({ email: 'nadie@test.com', codigo: '123456' })).body.codigo).toBe(
      'CODIGO_INCORRECTO',
    );
  });

  it('rechaza un código incorrecto y lo bloquea tras 5 intentos', async () => {
    await pedirCodigo();
    const codigo = ultimoCodigo();
    const incorrecto = codigo === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) expect((await verificar(incorrecto)).body.codigo).toBe('CODIGO_INCORRECTO');
    expect((await verificar(incorrecto)).body.codigo).toBe('CODIGO_BLOQUEADO');
    expect((await cambiar(codigo)).body.codigo).toBe('CODIGO_USADO');
  });

  it('rechaza un código vencido', async () => {
    await pedirCodigo();
    await prisma.codigoRecuperacion.updateMany({ data: { venceEn: new Date(Date.now() - 1000) } });
    const res = await cambiar(ultimoCodigo());
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ codigo: 'CODIGO_VENCIDO', error: 'El código venció. Pedí uno nuevo' });
  });

  it('un código nuevo invalida el anterior, y no se manda otro antes de un minuto', async () => {
    await pedirCodigo();
    const primero = ultimoCodigo();
    await pedirCodigo();
    expect(correo).toHaveBeenCalledOnce();
    await prisma.codigoRecuperacion.updateMany({ data: { creadoEn: new Date(Date.now() - 120_000) } });
    await pedirCodigo();
    expect(correo).toHaveBeenCalledTimes(2);
    const segundo = ultimoCodigo();
    if (primero !== segundo) expect((await verificar(primero)).body.codigo).toBe('CODIGO_INCORRECTO');
    expect((await verificar(segundo)).status).toBe(200);
  });

  it('valida la contraseña nueva y los datos (400)', async () => {
    await pedirCodigo();
    const corta = await cambiar(ultimoCodigo(), 'corta');
    expect(corta.status).toBe(400);
    expect(corta.body.detalles[0].mensaje).toBe('La contraseña debe tener al menos 8 caracteres');
    expect((await verificar('12')).status).toBe(400);
    expect((await pedirCodigo('no-es-email')).status).toBe(400);
  });

  it('si no se puede mandar el correo, lo informa con un 503', async () => {
    correo.mockRejectedValueOnce(new HttpError(503, 'No pudimos enviar el correo. Probá de nuevo en unos minutos'));
    const res = await pedirCodigo();
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/No pudimos enviar el correo/);
  });
});
