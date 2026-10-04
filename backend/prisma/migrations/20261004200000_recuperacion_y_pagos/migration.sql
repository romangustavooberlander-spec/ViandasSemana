-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'CANCELADO', 'DEVUELTO');

-- AlterEnum
-- Los pedidos que ya existían quedan CONFIRMADOS (se hicieron antes de que existiera el pago).
CREATE TYPE "EstadoPedido_new" AS ENUM ('PENDIENTE_PAGO', 'CONFIRMADO', 'CANCELADO');
ALTER TABLE "Pedido" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "Pedido" ALTER COLUMN "estado" TYPE "EstadoPedido_new"
  USING (CASE "estado"::text WHEN 'ACTIVO' THEN 'CONFIRMADO' ELSE "estado"::text END)::"EstadoPedido_new";
DROP TYPE "EstadoPedido";
ALTER TYPE "EstadoPedido_new" RENAME TO "EstadoPedido";

-- AlterTable
-- Los menús existentes quedan con precio 0: el cocinero tiene que cargarlo antes de que se pueda reservar.
ALTER TABLE "MenuDia" ADD COLUMN "precio" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MenuDia" ALTER COLUMN "precio" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Pedido" ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE_PAGO';

-- CreateTable
CREATE TABLE "CodigoRecuperacion" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "venceEn" TIMESTAMP(3) NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodigoRecuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "monto" INTEGER NOT NULL,
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "preferenciaId" TEXT,
    "urlPago" TEXT,
    "mpPagoId" TEXT,
    "venceEn" TIMESTAMP(3) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CodigoRecuperacion_usuarioId_idx" ON "CodigoRecuperacion"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_pedidoId_key" ON "Pago"("pedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_preferenciaId_key" ON "Pago"("preferenciaId");

-- AddForeignKey
ALTER TABLE "CodigoRecuperacion" ADD CONSTRAINT "CodigoRecuperacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

