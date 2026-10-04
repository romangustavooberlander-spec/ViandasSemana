import { describe, it, expect } from 'vitest';
import { enviarCorreo } from '../../src/lib/mailer';

describe('Mailer', () => {
  it('sin SMTP configurado responde 503 en vez de fallar en silencio', async () => {
    await expect(enviarCorreo('a@test.com', 'Asunto', 'Texto')).rejects.toMatchObject({ status: 503 });
  });
});
