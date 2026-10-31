import { useEffect, useState } from 'react';
import { enviar, ErrorApi, pedirApi, type Rol } from '../api/cliente';
import type { Avisar } from '../App';

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
}

// Pantalla del ADMINISTRADOR: da o quita el rol COCINERO sin entrar a la base de datos.
export default function Usuarios({ avisar }: { avisar: Avisar }) {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);

  const cargar = () =>
    pedirApi<Usuario[]>('/api/usuarios')
      .then(setUsuarios)
      .catch((e: ErrorApi) => avisar(e.message, 'error'));

  useEffect(() => {
    cargar();
  }, []);

  async function cambiarRol(usuario: Usuario, rol: Rol) {
    try {
      await enviar(`/api/usuarios/${usuario.id}/rol`, 'PATCH', { rol });
      avisar(rol === 'COCINERO' ? `${usuario.nombre} ahora es cocinero` : `${usuario.nombre} ahora es cliente`);
      await cargar();
    } catch (e) {
      avisar((e as ErrorApi).message, 'error');
    }
  }

  if (!usuarios) return <p className="vacio">Cargando usuarios…</p>;

  return (
    <section className="tarjeta">
      <h2>Usuarios</h2>
      <ul className="lista">
        {usuarios.map((u) => (
          <li key={u.id}>
            <span>
              <b>{u.nombre}</b> <small>{u.email}</small>
            </span>
            {u.rol === 'ADMINISTRADOR' ? (
              <small>Administrador</small>
            ) : u.rol === 'COCINERO' ? (
              <button className="boton secundario" onClick={() => cambiarRol(u, 'CLIENTE')}>
                Quitar cocinero
              </button>
            ) : (
              <button className="boton" onClick={() => cambiarRol(u, 'COCINERO')}>
                Hacer cocinero
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
