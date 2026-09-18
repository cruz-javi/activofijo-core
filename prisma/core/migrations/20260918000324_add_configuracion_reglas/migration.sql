-- CreateTable
CREATE TABLE "configuracion_reglas" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "reglas" JSONB NOT NULL,
    "resolucion" TEXT NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creado_por" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracion_reglas_pkey" PRIMARY KEY ("id")
);
