// Tests de INTEGRACIÓN: recorren la petición HTTP completa (ruta → middleware → respuesta).
// Los de menús y pedidos usarán además una base de datos de PRUEBAS (nunca la productiva).
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { crearApp } from '../../src/app';

const app = crearApp({ corsOrigins: ['http://localhost:5173'] });

describe('GET /api/health', () => {
  it('responde 200 con el estado de la API', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('ok');
  });

  it('incluye el encabezado CORS para el origen permitido', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('no habilita CORS para un origen desconocido', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://sitio-malicioso.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Manejo de errores', () => {
  it('devuelve 404 en una ruta inexistente', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
  });

  it('devuelve 400 (no 500) ante un JSON mal formado', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"mal formado"');
    expect(res.status).toBe(400);
  });
});
