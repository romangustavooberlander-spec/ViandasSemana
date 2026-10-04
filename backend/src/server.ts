// Punto de entrada: lee la configuración y levanta el servidor HTTP.
import { env } from './config/env';
import { crearApp } from './app';
import { logger } from './lib/logger';

const app = crearApp({ corsOrigins: env.corsOrigins });

app.listen(env.port, () => {
  logger.info({ puerto: env.port, entorno: env.nodeEnv }, 'API de ViandasSemana escuchando');
});
