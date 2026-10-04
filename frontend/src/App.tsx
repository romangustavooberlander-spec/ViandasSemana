import { useEffect, useState } from 'react';
import { pedirApi, ErrorApi } from './api/cliente';

type EstadoApi = { estado: 'cargando' } | { estado: 'ok'; hora: string } | { estado: 'error'; mensaje: string };

export default function App() {
  const [api, setApi] = useState<EstadoApi>({ estado: 'cargando' });

  useEffect(() => {
    pedirApi<{ estado: string; hora: string }>('/api/health')
      .then((r) => setApi({ estado: 'ok', hora: r.hora }))
      .catch((e: ErrorApi) => setApi({ estado: 'error', mensaje: e.message }));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '3rem auto', padding: '0 1rem' }}>
      <h1>ViandasSemana</h1>
      <p>Pedidos de viandas caseras, organizados.</p>
      <p>
        Estado de la API:{' '}
        {api.estado === 'cargando' && 'consultando…'}
        {api.estado === 'ok' && <strong style={{ color: 'green' }}>conectada</strong>}
        {api.estado === 'error' && <strong style={{ color: 'crimson' }}>{api.mensaje}</strong>}
      </p>
    </main>
  );
}
