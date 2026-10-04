import { Router } from 'express';
import { createHmac, randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { HttpError } from '../lib/errors';
import { logger } from '../lib/logger';
import { enviarCorreo } from '../lib/mailer';
import { prisma } from '../lib/prisma';
import { autenticar, type DatosToken } from '../middleware/auth';

export const authRouter = Router();

const esquemaEmail = z.string().trim().toLowerCase().email('Ingresá un email válido');
// bcrypt sólo usa los primeros 72 bytes: más largo no suma seguridad.
const esquemaPassword = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña puede tener hasta 72 caracteres');

const esquemaRegistro = z.object({
  nombre: z.string().trim().min(1),
  email: esquemaEmail,
  password: esquemaPassword,
});

const esquemaLogin = z.object({
  email: esquemaEmail,
  password: z.string().min(1),
});

// Todo usuario nuevo es CLIENTE. El rol COCINERO se asigna desde la base.
authRouter.post('/registro', async (req, res, next) => {
  try {
    const datos = esquemaRegistro.parse(req.body);
    if (await prisma.usuario.findUnique({ where: { email: datos.email } })) {
      throw new HttpError(409, 'Ya existe un usuario con ese email');
    }
    const usuario = await prisma.usuario.create({
      data: {
        nombre: datos.nombre,
        email: datos.email,
        passwordHash: await bcrypt.hash(datos.password, 10), // bcrypt incluye la sal
        rol: { connect: { nombre: 'CLIENTE' } },
      },
    });
    res.status(201).json({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: 'CLIENTE' });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = esquemaLogin.parse(req.body);
    const usuario = await prisma.usuario.findUnique({ where: { email }, include: { rol: true } });
    if (!usuario || !(await bcrypt.compare(password, usuario.passwordHash))) {
      logger.warn({ evento: 'login_fallido', email }, 'Login fallido');
      throw new HttpError(401, 'Email o contraseña incorrectos');
    }
    const datos: DatosToken = { id: usuario.id, v: usuario.versionToken };
    const token = jwt.sign(datos, env.jwtSecret, { expiresIn: '8h' });
    res.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol.nombre } });
  } catch (err) {
    next(err);
  }
});

// Invalida todos los tokens emitidos hasta ahora para este usuario.
authRouter.post('/logout', autenticar, async (req, res, next) => {
  try {
    await prisma.usuario.update({ where: { id: req.usuario!.id }, data: { versionToken: { increment: 1 } } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

authRouter.get('/yo', autenticar, (req, res) => {
  res.json(req.usuario);
});

// ---------- Recuperación de contraseña ----------
// 1) POST /recuperar           { email }                    → manda un código de 6 dígitos por correo
// 2) POST /recuperar/verificar { email, codigo }            → confirma que el código sirve
// 3) POST /recuperar/cambiar   { email, codigo, password }  → cambia la contraseña y consume el código

const MINUTOS_VALIDEZ_CODIGO = 15;
const MAX_INTENTOS_CODIGO = 5;
const SEGUNDOS_ENTRE_CODIGOS = 60;

const esquemaCodigo = z.object({
  email: esquemaEmail,
  codigo: z.string().trim().regex(/^\d{6}$/, 'El código tiene 6 dígitos'),
});

// Se guarda un HMAC del código (con la clave del servidor), nunca el código en sí.
const hashCodigo = (codigo: string) => createHmac('sha256', env.jwtSecret).update(codigo).digest('hex');

// La respuesta es la misma exista o no el email, para no revelar quién tiene cuenta.
authRouter.post('/recuperar', async (req, res) => {
  const { email } = z.object({ email: esquemaEmail }).parse(req.body);
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  const ahora = Date.now();
  // Si ya se mandó un código hace menos de un minuto no se manda otro (evita llenar la casilla).
  const reciente =
    usuario &&
    (await prisma.codigoRecuperacion.findFirst({
      where: { usuarioId: usuario.id, creadoEn: { gt: new Date(ahora - SEGUNDOS_ENTRE_CODIGOS * 1000) } },
    }));

  if (usuario && !reciente) {
    const codigo = randomInt(0, 1_000_000).toString().padStart(6, '0');
    // Pedir un código nuevo invalida los anteriores.
    await prisma.$transaction([
      prisma.codigoRecuperacion.updateMany({
        where: { usuarioId: usuario.id, usadoEn: null },
        data: { usadoEn: new Date(ahora) },
      }),
      prisma.codigoRecuperacion.create({
        data: {
          usuarioId: usuario.id,
          codigoHash: hashCodigo(codigo),
          venceEn: new Date(ahora + MINUTOS_VALIDEZ_CODIGO * 60_000),
        },
      }),
    ]);
    await enviarCorreo(
      usuario.email,
      'Tu código para recuperar la contraseña de ViandasSemana',
      `Hola ${usuario.nombre}:\n\n` +
        `Tu código para elegir una contraseña nueva es: ${codigo}\n\n` +
        `Vence en ${MINUTOS_VALIDEZ_CODIGO} minutos y sirve una sola vez.\n` +
        'Si no pediste este código, ignorá este correo: tu contraseña no cambia.',
    );
    logger.info({ evento: 'recuperacion_solicitada', usuarioId: usuario.id }, 'Código de recuperación enviado');
  }

  res.json({ mensaje: 'Si el email está registrado, te enviamos un código. Revisá tu correo (y la carpeta de spam).' });
});

// Devuelve el código vigente del usuario o lanza un 400 que explica por qué no sirve.
async function buscarCodigoValido(email: string, codigo: string) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  const ultimo =
    usuario &&
    (await prisma.codigoRecuperacion.findFirst({ where: { usuarioId: usuario.id }, orderBy: { id: 'desc' } }));
  const ahora = new Date();

  if (!ultimo || ultimo.codigoHash !== hashCodigo(codigo)) {
    if (ultimo && !ultimo.usadoEn && ultimo.venceEn > ahora) {
      const { intentos } = await prisma.codigoRecuperacion.update({
        where: { id: ultimo.id },
        data: { intentos: { increment: 1 } },
      });
      if (intentos >= MAX_INTENTOS_CODIGO) {
        await prisma.codigoRecuperacion.update({ where: { id: ultimo.id }, data: { usadoEn: ahora } });
        throw new HttpError(400, 'Demasiados intentos fallidos. Pedí un código nuevo', 'CODIGO_BLOQUEADO');
      }
    }
    throw new HttpError(400, 'El código es incorrecto', 'CODIGO_INCORRECTO');
  }
  if (ultimo.usadoEn) {
    throw new HttpError(400, 'Este código ya no es válido (ya se usó o se pidió otro). Pedí uno nuevo', 'CODIGO_USADO');
  }
  if (ultimo.venceEn <= ahora) {
    throw new HttpError(400, 'El código venció. Pedí uno nuevo', 'CODIGO_VENCIDO');
  }
  return ultimo;
}

authRouter.post('/recuperar/verificar', async (req, res) => {
  const { email, codigo } = esquemaCodigo.parse(req.body);
  await buscarCodigoValido(email, codigo);
  res.json({ mensaje: 'Código correcto. Elegí tu contraseña nueva' });
});

authRouter.post('/recuperar/cambiar', async (req, res) => {
  const { email, codigo, password } = esquemaCodigo.extend({ password: esquemaPassword }).parse(req.body);
  const valido = await buscarCodigoValido(email, codigo);
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    // Se marca como usado sólo si nadie lo usó antes: dos pedidos simultáneos no lo pueden usar dos veces.
    const { count } = await tx.codigoRecuperacion.updateMany({
      where: { id: valido.id, usadoEn: null },
      data: { usadoEn: new Date() },
    });
    if (count === 0) throw new HttpError(400, 'Este código ya fue utilizado. Pedí uno nuevo', 'CODIGO_USADO');
    // Además se cierran las sesiones abiertas: los tokens anteriores dejan de valer.
    await tx.usuario.update({
      where: { id: valido.usuarioId },
      data: { passwordHash, versionToken: { increment: 1 } },
    });
  });

  logger.info({ evento: 'password_restablecida', usuarioId: valido.usuarioId }, 'Contraseña restablecida');
  res.json({ mensaje: 'Tu contraseña se actualizó. Ya podés ingresar con la nueva' });
});
