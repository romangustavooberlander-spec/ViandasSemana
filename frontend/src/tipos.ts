// Formas de los datos que devuelve la API.
export interface Menu {
  id: number;
  fecha: string; // ISO; el día se lee en UTC, como lo guarda la base
  descripcion: string;
  cupoMaximo: number;
  horaCorte: string;
  reservadas: number;
  disponibles: number;
  abierto: boolean;
}

export interface Pedido {
  id: number;
  cantidad: number;
  estado: 'ACTIVO' | 'CANCELADO';
  cancelable: boolean;
  creadoEn: string;
  menu: Menu;
  usuario: { id: number; nombre: string };
}

// "2026-10-06T00:00:00.000Z" → "lunes, 6 de octubre"
export const formatearFecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

// Fecha de hoy en Argentina, en formato AAAA-MM-DD (sólo para filtrar qué se muestra).
export const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
