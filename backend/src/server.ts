// Punto de entrada en local (npm run dev / npm start): levanta el servidor HTTP.
// En Vercel no se usa: la plataforma toma el export por defecto de app.ts.
import { env } from './config/env';
import app from './app';
import { logger } from './lib/logger';

app.listen(env.port, () => {
  logger.info({ puerto: env.port, entorno: env.nodeEnv }, 'API de ViandasSemana escuchando');
});
