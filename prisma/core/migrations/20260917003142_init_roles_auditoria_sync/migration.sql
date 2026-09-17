-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'OFICINA', 'CAMPO');

-- CreateTable
CREATE TABLE "event_store" (
    "global_position" BIGSERIAL NOT NULL,
    "stream_id" UUID NOT NULL,
    "stream_type" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_schema" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "prev_hash" BYTEA,
    "hash" BYTEA NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_store_pkey" PRIMARY KEY ("global_position")
);

-- CreateTable
CREATE TABLE "activo_proyeccion" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "grupo_contable" TEXT NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "fecha_alta" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activo_proyeccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'CAMPO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria_acceso" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "email" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "exito" BOOLEAN NOT NULL,
    "detalle" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_acceso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sincronizacion_log" (
    "id" UUID NOT NULL,
    "estado" TEXT NOT NULL,
    "registros_importados" INTEGER NOT NULL DEFAULT 0,
    "registros_omitidos" INTEGER NOT NULL DEFAULT 0,
    "registros_con_error" INTEGER NOT NULL DEFAULT 0,
    "detalle" JSONB,
    "ejecutado_por" UUID NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sincronizacion_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projection_checkpoint" (
    "projection_name" TEXT NOT NULL,
    "last_position" BIGINT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projection_checkpoint_pkey" PRIMARY KEY ("projection_name")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_store_stream_id_version_key" ON "event_store"("stream_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "activo_proyeccion_codigo_key" ON "activo_proyeccion"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "auditoria_acceso_email_idx" ON "auditoria_acceso"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_token_hash_key" ON "refresh_token"("token_hash");

-- AddForeignKey
ALTER TABLE "auditoria_acceso" ADD CONSTRAINT "auditoria_acceso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
