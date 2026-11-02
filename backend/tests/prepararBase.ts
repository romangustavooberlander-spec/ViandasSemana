import { execSync } from 'node:child_process';
import type { GlobalSetupContext } from 'vitest/node';

// Se ejecuta una vez antes de todos los tests (globalSetup de vitest.config.ts):
// crea la base de pruebas si no existe y le aplica las migraciones pendientes.
export default function prepararBase({ config }: GlobalSetupContext) {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: config.env.DATABASE_URL },
  });
}
