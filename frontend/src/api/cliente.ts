// Único punto de contacto con el backend. El front NUNCA accede a la base de datos:
// todo pasa por HTTP a la API, cuya URL se define por configuración (VITE_API_URL).
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const CLAVE_SESION = 'viandas.sesion';

export type Rol = 'COCINERO' | 'CLIENTE';
export interface Sesion {
  token: string;
  usuario: { id: number; nombre: string; rol: Rol };
}

export class ErrorApi extends Error {
  constructor(public status: number, message: string, public codigo?: string) {
    super(message);
  }
}

export function leerSesion(): Sesion | null {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_SESION) ?? 'null');
  } catch {
    return null;
  }
}

export function guardarSesion(sesion: Sesion | null) {
  if (sesion) localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
  else localStorage.removeItem(CLAVE_SESION);
}

// App registra acá qué hacer ante un 401 (volver al login).
let alVencerSesion = () => {};
export function cuandoVenzaLaSesion(fn: () => void) {
  alVencerSesion = fn;
}

export async function pedirApi<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const token = leerSesion()?.token;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      headers: {
        'Content-Type': 'application/json',
        // El token viaja en el encabezado, nunca en la URL.
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opciones.headers,
      },
    });
  } catch {
    // El backend no responde: el front sigue funcionando y lo informa.
    throw new ErrorApi(0, 'No se pudo conectar con el servidor');
  }
  if (res.status === 204) return undefined as T;
  const cuerpo = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    guardarSesion(null);
    alVencerSesion();
  }
  if (!res.ok) {
    const mensaje = res.status === 403 ? 'No tenés permiso para hacer eso' : (cuerpo.error ?? 'Error inesperado');
    throw new ErrorApi(res.status, cuerpo.detalles?.[0]?.mensaje ?? mensaje, cuerpo.codigo);
  }
  return cuerpo as T;
}

export const enviar = (ruta: string, metodo: string, datos?: unknown) =>
  pedirApi(ruta, { method: metodo, body: datos === undefined ? undefined : JSON.stringify(datos) });
