import { useEffect, useState } from 'react';
import { cuandoVenzaLaSesion, enviar, ErrorApi, guardarSesion, leerSesion, pedirApi, type Sesion } from './api/cliente';
import Acceso from './pantallas/Acceso';
import Menus from './pantallas/Menus';
import Pedidos from './pantallas/Pedidos';

export type Avisar = (texto: string, tipo?: 'ok' | 'error') => void;
type Aviso = { texto: string; tipo: 'ok' | 'error' } | null;

export default function App() {
  const [sesion, setSesion] = useState<Sesion | null>(leerSesion);
  const [pestana, setPestana] = useState<'menus' | 'pedidos'>('menus');
  const [aviso, setAviso] = useState<Aviso>(null);

  const avisar: Avisar = (texto, tipo = 'ok') => setAviso({ texto, tipo });

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  useEffect(() => {
    // Ante un 401 en cualquier pantalla se vuelve al inicio de sesión.
    cuandoVenzaLaSesion(() => {
      setSesion(null);
      avisar('Tu sesión venció. Ingresá de nuevo.', 'error');
    });
    // Si había una sesión guardada, se confirma que el token siga valiendo.
    if (sesion) pedirApi('/api/auth/yo').catch(() => {});
  }, []);

  function ingresar(nueva: Sesion) {
    guardarSesion(nueva);
    setSesion(nueva);
    setPestana('menus');
  }

  async function salir() {
    await enviar('/api/auth/logout', 'POST').catch((e: ErrorApi) => e);
    guardarSesion(null);
    setSesion(null);
  }

  const esCocinero = sesion?.usuario.rol === 'COCINERO';

  return (
    <>
      <header className="barra">
        <div className="marca">
          <img src="/logo.svg" alt="" width={36} height={36} />
          <span>
            Viandas<b>Semana</b>
          </span>
        </div>
        {sesion && (
          <div className="usuario">
            <span>
              {sesion.usuario.nombre}
              <small>{esCocinero ? 'Cocina' : 'Cliente'}</small>
            </span>
            <button className="boton secundario" onClick={salir}>
              Salir
            </button>
          </div>
        )}
      </header>

      {sesion ? (
        <main className="contenido">
          <nav className="pestanas">
            <button className={pestana === 'menus' ? 'activa' : ''} onClick={() => setPestana('menus')}>
              {esCocinero ? 'Menús de la semana' : 'Menú de la semana'}
            </button>
            <button className={pestana === 'pedidos' ? 'activa' : ''} onClick={() => setPestana('pedidos')}>
              {esCocinero ? 'Pedidos a cocinar' : 'Mis pedidos'}
            </button>
          </nav>
          {pestana === 'menus' ? (
            <Menus esCocinero={esCocinero} avisar={avisar} />
          ) : (
            <Pedidos esCocinero={esCocinero} avisar={avisar} />
          )}
        </main>
      ) : (
        <Acceso alIngresar={ingresar} avisar={avisar} />
      )}

      {aviso && (
        <div className={`aviso ${aviso.tipo}`} role="status" onClick={() => setAviso(null)}>
          {aviso.texto}
        </div>
      )}
    </>
  );
}
