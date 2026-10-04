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

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: requerida('DATABASE_URL'),
  jwtSecret: requerida('JWT_SECRET'),
  // Orígenes permitidos por CORS, separados por coma (ej: la URL del front en Vercel).
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim()),
};
