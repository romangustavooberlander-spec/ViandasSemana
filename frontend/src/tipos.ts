// Formas de los datos que devuelve la API.
export interface Menu {
  id: number;
  fecha: string; // ISO; el día se lee en UTC, como lo guarda la base
  descripcion: string;
  cupoMaximo: number;
  horaCorte: string;
  precio: number; // por vianda, en pesos
  reservadas: number; // pagadas o esperando el pago
  disponibles: number;
  abierto: boolean;
}

export interface Pedido {
  id: number;
  cantidad: number;
  estado: 'PENDIENTE_PAGO' | 'CONFIRMADO' | 'CANCELADO';
  cancelable: boolean;
  pagable: boolean;
  // null en los pedidos hechos antes de que existieran los pagos.
  pago: { estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'CANCELADO' | 'DEVUELTO'; monto: number } | null;
  creadoEn: string;
  menu: Menu;
  usuario: { id: number; nombre: string };
}

// "2026-10-06T00:00:00.000Z" → "lunes, 6 de octubre"
export const formatearFecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

// Fecha de hoy en Argentina, en formato AAAA-MM-DD (sólo para filtrar qué se muestra).
export const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

// 3500 → "$ 3.500"
export const formatearPrecio = (pesos: number) =>
  pesos.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
