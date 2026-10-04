// Única lectura de variables de entorno. Ningún secreto se escribe en el código:
// en local vienen del archivo .env y en producción de los secretos de la plataforma.
import 'dotenv/config';

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}`);
  }
  return valor;
}

const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((o) => o.trim());

// El correo y Mercado Pago son opcionales al arrancar (los tests no los usan): si faltan,
// las rutas que los necesitan responden 503 con un mensaje claro y lo registran en el log.
export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: requerida('DATABASE_URL'),
  jwtSecret: requerida('JWT_SECRET'),
  // Orígenes permitidos por CORS, separados por coma (ej: la URL del front en Vercel).
  corsOrigins,

  // Correo saliente (Nodemailer por SMTP), para los códigos de recuperación de contraseña.
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    usuario: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASS ?? '',
  },
  mailFrom: process.env.MAIL_FROM ?? process.env.SMTP_USER ?? '',

  // Mercado Pago (Checkout Pro). Access token privado de la cuenta que cobra.
  mpAccessToken: process.env.MP_ACCESS_TOKEN ?? '',
  // URL del frontend: Mercado Pago devuelve al cliente acá después de pagar.
  frontendUrl: (process.env.FRONTEND_URL ?? corsOrigins[0]).replace(/\/$/, ''),
  // URL pública de esta API: Mercado Pago le avisa los pagos a <API_URL>/api/pagos/notificacion.
  apiUrl: (process.env.API_URL ?? '').replace(/\/$/, ''),
};
