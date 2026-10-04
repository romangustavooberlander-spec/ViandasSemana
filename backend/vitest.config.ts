import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Los tests usan SIEMPRE la base de pruebas (docker compose: db_test en :5433), nunca la de desarrollo.
    env: {
      DATABASE_URL: 'postgresql://viandas:viandas@localhost:5433/viandas_test',
      JWT_SECRET: 'secreto-solo-para-tests',
      NODE_ENV: 'test',
    },
    include: ['tests/**/*.test.ts'],
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
