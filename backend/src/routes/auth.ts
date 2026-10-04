import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { HttpError } from '../lib/errors';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { autenticar, type DatosToken } from '../middleware/auth';

export const authRouter = Router();

const esquemaRegistro = z.object({
  nombre: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
});

const esquemaLogin = z.object({
  email: z.string().trim().toLowerCase().email(),
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
