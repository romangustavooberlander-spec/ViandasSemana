import { useState, type FormEvent } from 'react';
import { enviar, ErrorApi, pedirApi, type Sesion } from '../api/cliente';
import type { Avisar } from '../App';
import Recuperar from './Recuperar';

interface Props {
  alIngresar: (sesion: Sesion) => void;
  avisar: Avisar;
}

export default function Acceso({ alIngresar, avisar }: Props) {
  const [modo, setModo] = useState<'login' | 'registro' | 'recuperar'>('login');
  const [cargando, setCargando] = useState(false);

  async function enviarFormulario(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.currentTarget));
    setCargando(true);
    try {
      if (modo === 'registro') await enviar('/api/auth/registro', 'POST', datos);
      const login = { email: datos.email, password: datos.password };
      alIngresar(await pedirApi<Sesion>('/api/auth/login', { method: 'POST', body: JSON.stringify(login) }));
    } catch (err) {
      avisar((err as ErrorApi).message, 'error');
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="acceso">
      <section className="presentacion">
        <img src="/logo.svg" alt="Logo de ViandasSemana" width={96} height={96} />
        <h1>Comida casera para toda la semana</h1>
        <p>Mirá el menú de cada día, reservá tus viandas antes del horario de corte y cancelá si cambian tus planes.</p>
      </section>

      {modo === 'recuperar' ? (
        <Recuperar alVolver={() => setModo('login')} avisar={avisar} />
      ) : (
        <form className="tarjeta formulario" onSubmit={enviarFormulario}>
          <div className="pestanas">
            <button type="button" className={modo === 'login' ? 'activa' : ''} onClick={() => setModo('login')}>
              Ingresar
            </button>
            <button type="button" className={modo === 'registro' ? 'activa' : ''} onClick={() => setModo('registro')}>
              Crear cuenta
            </button>
          </div>
          {modo === 'registro' && (
            <label>
              Nombre
              <input name="nombre" required autoComplete="name" />
            </label>
          )}
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              required
              minLength={modo === 'registro' ? 8 : 1}
              autoComplete={modo === 'registro' ? 'new-password' : 'current-password'}
            />
            {modo === 'registro' && <small>Al menos 8 caracteres.</small>}
          </label>
          <button className="boton" disabled={cargando}>
            {cargando ? 'Un momento…' : modo === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </button>
          {modo === 'login' && (
            <button type="button" className="enlace" onClick={() => setModo('recuperar')}>
              ¿Olvidaste tu contraseña?
            </button>
          )}
        </form>
      )}
    </main>
  );
}
