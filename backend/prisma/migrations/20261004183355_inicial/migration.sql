-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('ACTIVO', 'CANCELADO');

-- CreateTable
CREATE TABLE "Rol" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rolId" INTEGER NOT NULL,
    "versionToken" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuDia" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cupoMaximo" INTEGER NOT NULL,
    "horaCorte" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuDia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" SERIAL NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'ACTIVO',
    "usuarioId" INTEGER NOT NULL,
    "menuId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rol_nombre_key" ON "Rol"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MenuDia_fecha_key" ON "MenuDia"("fecha");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "MenuDia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Roles del sistema (se guardan como datos, no se comparan como texto fijo en el código).
INSERT INTO "Rol" ("nombre") VALUES ('COCINERO'), ('CLIENTE');
