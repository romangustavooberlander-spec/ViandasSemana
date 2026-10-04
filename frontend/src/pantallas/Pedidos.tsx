import { useEffect, useState } from 'react';
import { enviar, ErrorApi, pedirApi } from '../api/cliente';
import type { Avisar } from '../App';
import { formatearFecha, hoy, type Pedido } from '../tipos';

interface Props {
  esCocinero: boolean;
  avisar: Avisar;
}

export default function Pedidos({ esCocinero, avisar }: Props) {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [verAnteriores, setVerAnteriores] = useState(false);

  const cargar = () =>
    pedirApi<Pedido[]>('/api/pedidos')
      .then(setPedidos)
      .catch((e: ErrorApi) => avisar(e.message, 'error'));

  useEffect(() => {
    cargar();
  }, []);

  async function cancelar(pedido: Pedido) {
    if (!confirm(`¿Cancelar tu pedido del ${formatearFecha(pedido.menu.fecha)}?`)) return;
    try {
      await enviar(`/api/pedidos/${pedido.id}/cancelar`, 'PATCH');
      avisar('Pedido cancelado');
      await cargar();
    } catch (e) {
      avisar((e as ErrorApi).message, 'error');
    }
  }

  if (!pedidos) return <p className="vacio">Cargando pedidos…</p>;
  const visibles = pedidos.filter((p) => verAnteriores || p.menu.fecha.slice(0, 10) >= hoy());

  // Agrupa por día del menú, ordenado por fecha.
  const porDia = new Map<string, Pedido[]>();
  for (const p of [...visibles].sort((a, b) => a.menu.fecha.localeCompare(b.menu.fecha))) {
    porDia.set(p.menu.fecha, [...(porDia.get(p.menu.fecha) ?? []), p]);
  }

  return (
    <section>
      <div className="encabezado">
        <label className="interruptor">
          <input type="checkbox" checked={verAnteriores} onChange={(e) => setVerAnteriores(e.target.checked)} />
          Ver días anteriores
        </label>
      </div>

      {porDia.size === 0 && (
        <p className="vacio">
          {esCocinero ? 'No hay pedidos para los próximos días.' : 'No tenés pedidos. Reservá desde el menú de la semana.'}
        </p>
      )}

      {[...porDia].map(([fecha, delDia]) => {
        const menu = delDia[0].menu;
        const activos = delDia.filter((p) => p.estado === 'ACTIVO');
        const total = activos.reduce((suma, p) => suma + p.cantidad, 0);
        return (
          <article key={fecha} className="tarjeta dia">
            <header>
              <div>
                <h3>{formatearFecha(fecha)}</h3>
                <p className="detalle">{menu.descripcion}</p>
              </div>
              {esCocinero && (
                <div className="total">
                  <strong>{total}</strong>
                  <span>viandas a cocinar</span>
                </div>
              )}
            </header>
            <ul className="lista">
              {(esCocinero ? activos : delDia).map((p) => (
                <li key={p.id} className={p.estado === 'CANCELADO' ? 'cancelado' : ''}>
                  <span>
                    <b>{p.cantidad}</b> {p.cantidad === 1 ? 'vianda' : 'viandas'}
                    {esCocinero && <> · {p.usuario.nombre}</>}
                  </span>
                  {!esCocinero &&
                    (p.cancelable ? (
                      <button className="boton secundario chico" onClick={() => cancelar(p)}>
                        Cancelar
                      </button>
                    ) : (
                      <span className={`etiqueta ${p.estado === 'ACTIVO' ? 'verde' : 'gris'}`}>
                        {p.estado === 'ACTIVO' ? 'Confirmado' : 'Cancelado'}
                      </span>
                    ))}
                </li>
              ))}
              {esCocinero && activos.length === 0 && <li className="cancelado">Todos los pedidos de este día se cancelaron.</li>}
            </ul>
          </article>
        );
      })}
    </section>
  );
}
