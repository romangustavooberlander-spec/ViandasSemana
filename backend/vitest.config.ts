import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Base de pruebas: la de docker compose (db_test en :5433) o, si no hay Docker,
// la que indique TEST_DATABASE_URL en backend/.env (por ejemplo en el PostgreSQL local).
// Del .env se lee SÓLO esa variable, para no mezclar la configuración de desarrollo.
const urlTest =
  process.env.TEST_DATABASE_URL ??
  config({ processEnv: {} }).parsed?.TEST_DATABASE_URL ??
  'postgresql://viandas:viandas@localhost:5433/viandas_test';

// Los tests borran todas las tablas: nunca deben apuntar a una base que no sea de pruebas.
if (!new URL(urlTest).pathname.includes('test')) {
  throw new Error(`La base de tests debe llamarse "..._test" (se recibió ${new URL(urlTest).pathname})`);
}

export default defineConfig({
  test: {
    environment: 'node',
    // Los tests usan SIEMPRE la base de pruebas, nunca la de desarrollo.
    env: {
      DATABASE_URL: urlTest,
      JWT_SECRET: 'secreto-solo-para-tests',
      NODE_ENV: 'test',
      // Mercado Pago no se llama de verdad: los tests reemplazan fetch (ver tests/integration/ayudantes.ts).
      MP_ACCESS_TOKEN: 'TEST-solo-para-tests',
      FRONTEND_URL: 'http://localhost:5173',
    },
    include: ['tests/**/*.test.ts'],
    // Antes de empezar crea la base de pruebas (si no existe) y aplica las migraciones.
    globalSetup: ['tests/prepararBase.ts'],
    // Los tests de integración comparten la base de pruebas: se ejecutan de a uno.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      // Exclusiones justificadas (consigna 3.7.3): punto de entrada y configuración.
      exclude: [
        'src/server.ts', // punto de entrada: sólo levanta el servidor
        'src/config/**', // lectura de variables de entorno
      ],
      // Umbral obligatorio: si baja del 65 %, el comando falla y el pipeline no despliega.
      thresholds: {
        lines: 65,
      },
    },
  },
});
