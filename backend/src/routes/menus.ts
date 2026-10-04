import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/errors';
import { autenticar, exigirRol } from '../middleware/auth';
import { OCUPAN_CUPO, vencerReservasImpagas } from '../lib/pagos';
import { yaPasoElCorte } from '../domain/reglasPedido';

export const menusRouter = Router();

const esquemaMenu = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato AAAA-MM-DD'),
  descripcion: z.string().trim().min(1),
  cupoMaximo: z.number().int().min(1),
  precio: z.number().int('El precio va en pesos, sin centavos').min(1, 'El precio tiene que ser mayor a cero'),
  horaCorte: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:mm'),
});

const esquemaId = z.coerce.number().int().positive();

// Devuelve el menú con cuántas viandas hay reservadas (pagadas o esperando el pago), cuántas quedan
// y si todavía se aceptan pedidos. Así el frontend no tiene que calcular ninguna regla.
async function buscarMenu(id: number) {
  const menu = await prisma.menuDia.findUnique({ where: { id } });
  if (!menu) throw new HttpError(404, 'Menú no encontrado');
  return conTotales(menu);
}

async function conTotales<T extends { id: number; cupoMaximo: number; precio: number; fecha: Date; horaCorte: string }>(menu: T) {
  const { _sum } = await prisma.pedido.aggregate({
    where: { menuId: menu.id, estado: OCUPAN_CUPO },
    _sum: { cantidad: true },
  });
  const reservadas = _sum.cantidad ?? 0;
  return {
    ...menu,
    reservadas,
    disponibles: Math.max(0, menu.cupoMaximo - reservadas),
    // Se puede reservar si tiene precio (los menús anteriores a los pagos quedaron en 0) y no pasó el corte.
    abierto: menu.precio > 0 && !yaPasoElCorte(menu.fecha, menu.horaCorte, new Date()),
  };
}

function aDatos(body: unknown) {
  const datos = esquemaMenu.parse(body);
  return { ...datos, fecha: new Date(`${datos.fecha}T00:00:00Z`) };
}

menusRouter.use(autenticar);
// Antes de contar el cupo se liberan las reservas que no se pagaron a tiempo.
menusRouter.use(async (_req, _res, next) => {
  await vencerReservasImpagas();
  next();
});

menusRouter.get('/', async (_req, res) => {
  const menus = await prisma.menuDia.findMany({ orderBy: { fecha: 'asc' } });
  res.json(await Promise.all(menus.map(conTotales)));
});

menusRouter.get('/:id', async (req, res) => {
  res.json(await buscarMenu(esquemaId.parse(req.params.id)));
});

menusRouter.post('/', exigirRol('COCINERO'), async (req, res) => {
  const datos = aDatos(req.body);
  if (await prisma.menuDia.findUnique({ where: { fecha: datos.fecha } })) {
    throw new HttpError(409, 'Ya existe un menú para esa fecha');
  }
  const menu = await prisma.menuDia.create({ data: datos });
  res.status(201).json(await conTotales(menu));
});

menusRouter.put('/:id', exigirRol('COCINERO'), async (req, res) => {
  const id = esquemaId.parse(req.params.id);
  const datos = aDatos(req.body);
  await buscarMenu(id);
  const otro = await prisma.menuDia.findUnique({ where: { fecha: datos.fecha } });
  if (otro && otro.id !== id) throw new HttpError(409, 'Ya existe un menú para esa fecha');
  const menu = await prisma.menuDia.update({ where: { id }, data: datos });
  res.json(await conTotales(menu));
});

menusRouter.delete('/:id', exigirRol('COCINERO'), async (req, res) => {
  const id = esquemaId.parse(req.params.id);
  await buscarMenu(id);
  if (await prisma.pedido.count({ where: { menuId: id } })) {
    throw new HttpError(409, 'No se puede borrar un menú que tiene pedidos');
  }
  await prisma.menuDia.delete({ where: { id } });
  res.status(204).end();
});
