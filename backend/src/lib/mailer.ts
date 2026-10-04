// Envío de correos con Nodemailer por SMTP. La configuración viene de las variables SMTP_*.
import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { HttpError } from './errors';
import { logger } from './logger';

const transporte = env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465, // 465 usa TLS directo; 587 usa STARTTLS
      auth: env.smtp.usuario ? { user: env.smtp.usuario, pass: env.smtp.password } : undefined,
    })
  : null;

export async function enviarCorreo(para: string, asunto: string, texto: string) {
  if (!transporte) {
    logger.error({ evento: 'correo_sin_configurar' }, 'Falta SMTP_HOST: no se pueden enviar correos');
    throw new HttpError(503, 'El envío de correos no está disponible en este momento');
  }
  try {
    await transporte.sendMail({ from: env.mailFrom, to: para, subject: asunto, text: texto });
  } catch (err) {
    logger.error({ evento: 'correo_fallido', err }, 'No se pudo enviar un correo');
    throw new HttpError(503, 'No pudimos enviar el correo. Probá de nuevo en unos minutos');
  }
}
