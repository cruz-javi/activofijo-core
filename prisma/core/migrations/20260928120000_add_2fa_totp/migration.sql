-- AlterTable
ALTER TABLE "auth_usuario"
  ADD COLUMN IF NOT EXISTS "two_factor_ultimo_paso" BIGINT,
  ADD COLUMN IF NOT EXISTS "two_factor_activado_en" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE IF NOT EXISTS "auth_codigo_respaldo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "codigo_hash" TEXT NOT NULL,
    "usado_en" TIMESTAMPTZ,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_codigo_respaldo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "auth_codigo_respaldo_usuario_id_idx" ON "auth_codigo_respaldo"("usuario_id");

-- AddForeignKey
ALTER TABLE "auth_codigo_respaldo"
  ADD CONSTRAINT "auth_codigo_respaldo_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "auth_usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
