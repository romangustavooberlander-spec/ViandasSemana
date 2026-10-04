import { useState, type FormEvent } from 'react';
import { enviar, ErrorApi } from '../api/cliente';
import type { Avisar } from '../App';

interface Props {
  alVolver: () => void;
  avisar: Avisar;
}

type Respuesta = { mensaje: string };

// Tres pasos: email → código que llega por correo → contraseña nueva.
export default function Recuperar({ alVolver, avisar }: Props) {
  const [paso, setPaso] = useState<'email' | 'codigo' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [cargando, setCargando] = useState(false);

  const pedirCodigo = async (direccion: string) =>
    avisar(((await enviar('/api/auth/recuperar', 'POST', { email: direccion })) as Respuesta).mensaje);

  async function enviarFormulario(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setCargando(true);
    try {
      if (paso === 'email') {
        await pedirCodigo(datos.email);
        setEmail(datos.email);
        setPaso('codigo');
      } else if (paso === 'codigo') {
        await enviar('/api/auth/recuperar/verificar', 'POST', { email, codigo: datos.codigo });
        setCodigo(datos.codigo);
        setPaso('password');
      } else {
        if (datos.password !== datos.repetir) throw new ErrorApi(400, 'Las contraseñas no coinciden');
        const r = (await enviar('/api/auth/recuperar/cambiar', 'POST', { email, codigo, password: datos.password })) as Respuesta;
        avisar(r.mensaje);
        alVolver();
      }
    } catch (err) {
      const error = err as ErrorApi;
      avisar(error.message, 'error');
      // Si el código venció o se usó mientras tanto, hay que volver a cargar uno.
      if (paso === 'password' && error.codigo?.startsWith('CODIGO_')) setPaso('codigo');
    } finally {
      setCargando(false);
    }
  }

  return (
    <form key={paso} className="tarjeta formulario" onSubmit={enviarFormulario}>
      <h3>Recuperar contraseña</h3>
      {paso === 'email' && (
        <>
          <p className="ayuda">Ingresá el email de tu cuenta y te mandamos un código para elegir una contraseña nueva.</p>
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
        </>
      )}
      {paso === 'codigo' && (
        <>
          <p className="ayuda">
            Si <b>{email}</b> tiene una cuenta, le llegó un código de 6 dígitos. Vence en 15 minutos.
          </p>
          <label>
            Código
            <input name="codigo" required inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" title="6 dígitos" />
          </label>
        </>
      )}
      {paso === 'password' && (
        <>
          <label>
            Contraseña nueva
            <input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" />
            <small>Al menos 8 caracteres.</small>
          </label>
          <label>
            Repetila
            <input name="repetir" type="password" required minLength={8} maxLength={72} autoComplete="new-password" />
          </label>
        </>
      )}
      <button className="boton" disabled={cargando}>
        {cargando ? 'Un momento…' : paso === 'email' ? 'Enviar código' : paso === 'codigo' ? 'Verificar código' : 'Guardar contraseña'}
      </button>
      {paso === 'codigo' && (
        <button type="button" className="enlace" disabled={cargando} onClick={() => pedirCodigo(email).catch((e: ErrorApi) => avisar(e.message, 'error'))}>
          Reenviar código
        </button>
      )}
      <button type="button" className="enlace" onClick={alVolver}>
        Volver a ingresar
      </button>
    </form>
  );
}
