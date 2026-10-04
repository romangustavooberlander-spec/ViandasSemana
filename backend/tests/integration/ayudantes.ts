// Utilidades compartidas por los tests de integración. Usan la base de PRUEBAS.
// Los roles los crea la migración inicial, por eso no se borran.
import jwt from 'jsonwebtoken';
import { prisma } from '../../src/lib/prisma';

export async function limpiarBase() {
  await prisma.pedido.deleteMany();
  await prisma.menuDia.deleteMany();
  await prisma.usuario.deleteMany();
}

// Crea un usuario con el rol pedido y devuelve el encabezado Authorization listo para usar.
export async function crearUsuario(rol: 'COCINERO' | 'CLIENTE', email = `${rol.toLowerCase()}@test.com`) {
  const usuario = await prisma.usuario.create({
    data: { email, nombre: rol, passwordHash: 'x', rol: { connect: { nombre: rol } } },
  });
  const token = jwt.sign({ id: usuario.id, v: usuario.versionToken }, process.env.JWT_SECRET!);
  return { usuario, auth: `Bearer ${token}` };
}
