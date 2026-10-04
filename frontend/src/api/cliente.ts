// Único punto de contacto con el backend. El front NUNCA accede a la base de datos:
// todo pasa por HTTP a la API, cuya URL se define por configuración (VITE_API_URL).
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ErrorApi extends Error {
  constructor(public status: number, message: string, public codigo?: string) {
    super(message);
  }
}

export async function pedirApi<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      headers: { 'Content-Type': 'application/json', ...opciones.headers },
    });
  } catch {
    // El backend no responde: el front sigue funcionando y lo informa.
    throw new ErrorApi(0, 'No se pudo conectar con el servidor');
  }
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ErrorApi(res.status, cuerpo.error ?? 'Error inesperado', cuerpo.codigo);
  }
  return cuerpo as T;
}
