import { useEffect, useState } from 'react';
import { enviar, ErrorApi, pedirApi } from '../api/cliente';
import type { Avisar } from '../App';
import { formatearFecha, formatearPrecio, hoy, type Pedido } from '../tipos';

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
    const devolucion = pedido.pago?.estado === 'APROBADO' ? ' Te devolvemos el pago por Mercado Pago.' : '';
    if (!confirm(`¿Cancelar tu pedido del ${formatearFecha(pedido.menu.fecha)}?${devolucion}`)) return;
    try {
      await enviar(`/api/pedidos/${pedido.id}/cancelar`, 'PATCH');
      avisar('Pedido cancelado');
      await cargar();
    } catch (e) {
      avisar((e as ErrorApi).message, 'error');
    }
  }

  async function pagar(pedido: Pedido) {
    try {
      const { urlPago } = await pedirApi<{ urlPago: string }>(`/api/pedidos/${pedido.id}/pagar`, { method: 'POST' });
      window.location.href = urlPago;
    } catch (e) {
      avisar((e as ErrorApi).message, 'error');
      await cargar();
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
        // Se cocinan sólo los pedidos pagados.
        const activos = delDia.filter((p) => p.estado === 'CONFIRMADO');
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
                  {!esCocinero && (
                    <span className="estado-pedido">
                      <Estado pedido={p} />
                      {p.pagable && (
                        <button className="boton chico" onClick={() => pagar(p)}>
                          Pagar {p.pago && formatearPrecio(p.pago.monto)}
                        </button>
                      )}
                      {p.cancelable && (
                        <button className="boton secundario chico" onClick={() => cancelar(p)}>
                          Cancelar
                        </button>
                      )}
                    </span>
                  )}
                </li>
              ))}
              {esCocinero && activos.length === 0 && <li className="cancelado">No hay pedidos pagados para este día.</li>}
            </ul>
          </article>
        );
      })}
    </section>
  );
}

// Etiqueta con el estado de la reserva y de su pago, tal como lo informa la API.
function Estado({ pedido: { estado, pago } }: { pedido: Pedido }) {
  if (estado === 'CONFIRMADO') return <span className="etiqueta verde">{pago ? 'Pagado' : 'Confirmado'}</span>;
  if (estado === 'CANCELADO') {
    return <span className="etiqueta gris">{pago?.estado === 'DEVUELTO' ? 'Cancelado · pago devuelto' : 'Cancelado'}</span>;
  }
  const texto = pago?.estado === 'RECHAZADO' ? 'Pago rechazado' : pago?.estado === 'CANCELADO' ? 'Pago no completado' : 'Falta pagar';
  return <span className="etiqueta naranja">{texto}</span>;
}
