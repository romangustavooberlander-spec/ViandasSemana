import { useEffect, useState, type FormEvent } from 'react';
import { enviar, ErrorApi, pedirApi } from '../api/cliente';
import type { Avisar } from '../App';
import { formatearFecha, formatearPrecio, hoy, type Menu } from '../tipos';

interface Props {
  esCocinero: boolean;
  avisar: Avisar;
}

export default function Menus({ esCocinero, avisar }: Props) {
  const [menus, setMenus] = useState<Menu[] | null>(null);
  const [verAnteriores, setVerAnteriores] = useState(false);
  const [editando, setEditando] = useState<Menu | 'nuevo' | null>(null);

  const cargar = () =>
    pedirApi<Menu[]>('/api/menus')
      .then(setMenus)
      .catch((e: ErrorApi) => avisar(e.message, 'error'));

  useEffect(() => {
    cargar();
  }, []);

  // Ejecuta una acción contra la API, avisa el resultado y recarga la lista.
  async function hacer(accion: () => Promise<unknown>, exito: string) {
    try {
      await accion();
      avisar(exito);
      setEditando(null);
      await cargar();
    } catch (e) {
      avisar((e as ErrorApi).message, 'error');
    }
  }

  // La reserva queda pendiente hasta pagarla: se crea y se pasa a Mercado Pago a pagar el total.
  async function reservar(e: FormEvent<HTMLFormElement>, menu: Menu) {
    e.preventDefault();
    const cantidad = Number(new FormData(e.currentTarget).get('cantidad'));
    try {
      const { urlPago } = (await enviar('/api/pedidos', 'POST', { menuId: menu.id, cantidad })) as { urlPago: string };
      avisar('Te llevamos a Mercado Pago para pagar tu reserva…');
      window.location.href = urlPago;
    } catch (err) {
      avisar((err as ErrorApi).message, 'error');
      await cargar();
    }
  }

  function guardar(datos: Record<string, unknown>) {
    const esNuevo = editando === 'nuevo';
    hacer(
      () => enviar(esNuevo ? '/api/menus' : `/api/menus/${(editando as Menu).id}`, esNuevo ? 'POST' : 'PUT', datos),
      esNuevo ? 'Menú creado' : 'Menú actualizado',
    );
  }

  function borrar(menu: Menu) {
    if (confirm(`¿Borrar el menú del ${formatearFecha(menu.fecha)}?`)) {
      hacer(() => enviar(`/api/menus/${menu.id}`, 'DELETE'), 'Menú borrado');
    }
  }

  if (!menus) return <p className="vacio">Cargando menús…</p>;
  const visibles = menus.filter((m) => verAnteriores || m.fecha.slice(0, 10) >= hoy());

  return (
    <section>
      <div className="encabezado">
        <label className="interruptor">
          <input type="checkbox" checked={verAnteriores} onChange={(e) => setVerAnteriores(e.target.checked)} />
          Ver días anteriores
        </label>
        {esCocinero && (
          <button className="boton" onClick={() => setEditando('nuevo')}>
            + Nuevo menú
          </button>
        )}
      </div>

      {editando && <FormularioMenu menu={editando === 'nuevo' ? null : editando} alGuardar={guardar} alCancelar={() => setEditando(null)} />}

      {visibles.length === 0 && (
        <p className="vacio">
          {esCocinero ? 'Todavía no cargaste menús para los próximos días.' : 'Todavía no hay menús publicados. ¡Volvé pronto!'}
        </p>
      )}

      <div className="grilla">
        {visibles.map((menu) => (
          <article key={menu.id} className={`tarjeta menu ${menu.abierto ? '' : 'cerrado'}`}>
            <header>
              <h3>{formatearFecha(menu.fecha)}</h3>
              <span className={`etiqueta ${menu.abierto ? (menu.disponibles ? 'verde' : 'naranja') : 'gris'}`}>
                {!menu.abierto ? 'Cerrado' : menu.disponibles ? `Quedan ${menu.disponibles}` : 'Agotado'}
              </span>
            </header>
            <p className="descripcion">{menu.descripcion}</p>
            <p className="precio">{menu.precio ? `${formatearPrecio(menu.precio)} por vianda` : 'Sin precio: todavía no se puede reservar'}</p>
            <div className="cupo" title={`${menu.reservadas} de ${menu.cupoMaximo} reservadas`}>
              <div style={{ width: `${Math.min(100, (menu.reservadas / menu.cupoMaximo) * 100)}%` }} />
            </div>
            <p className="detalle">
              {menu.reservadas} de {menu.cupoMaximo} viandas reservadas · pedidos hasta las {menu.horaCorte}
            </p>

            {esCocinero ? (
              <div className="acciones">
                <button className="boton secundario" onClick={() => setEditando(menu)}>
                  Editar
                </button>
                <button className="boton peligro" onClick={() => borrar(menu)}>
                  Borrar
                </button>
              </div>
            ) : (
              menu.abierto &&
              menu.disponibles > 0 && (
                <form className="acciones" onSubmit={(e) => reservar(e, menu)}>
                  <input name="cantidad" type="number" min={1} defaultValue={1} aria-label="Cantidad" />
                  <button className="boton">Reservar y pagar</button>
                </form>
              )
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

interface PropsFormulario {
  menu: Menu | null;
  alGuardar: (datos: Record<string, unknown>) => void;
  alCancelar: () => void;
}

function FormularioMenu({ menu, alGuardar, alCancelar }: PropsFormulario) {
  function enviarFormulario(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.currentTarget));
    alGuardar({ ...datos, cupoMaximo: Number(datos.cupoMaximo), precio: Number(datos.precio) });
  }

  return (
    <form key={menu?.id ?? 'nuevo'} className="tarjeta formulario menu-form" onSubmit={enviarFormulario}>
      <h3>{menu ? 'Editar menú' : 'Nuevo menú'}</h3>
      <div className="campos">
        <label>
          Día
          <input name="fecha" type="date" required defaultValue={menu?.fecha.slice(0, 10) ?? hoy()} />
        </label>
        <label>
          Viandas disponibles
          <input name="cupoMaximo" type="number" min={1} required defaultValue={menu?.cupoMaximo ?? 20} />
        </label>
        <label>
          Precio por vianda ($)
          <input name="precio" type="number" min={1} step={1} required defaultValue={menu?.precio || ''} />
        </label>
        <label>
          Pedidos hasta las
          <input name="horaCorte" type="time" required defaultValue={menu?.horaCorte ?? '10:00'} />
        </label>
      </div>
      <label>
        Plato
        <textarea name="descripcion" required rows={2} defaultValue={menu?.descripcion} placeholder="Ej.: Milanesa con puré y ensalada" />
      </label>
      <div className="acciones">
        <button type="button" className="boton secundario" onClick={alCancelar}>
          Cancelar
        </button>
        <button className="boton">Guardar</button>
      </div>
    </form>
  );
}
