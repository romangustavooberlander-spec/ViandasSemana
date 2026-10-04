import { PrismaClient } from '@prisma/client';

// Una sola conexión a la base para toda la API.
export const prisma = new PrismaClient();
