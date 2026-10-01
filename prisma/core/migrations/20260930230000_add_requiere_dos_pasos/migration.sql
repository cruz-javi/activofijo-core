-- AlterTable
ALTER TABLE "auth_rol" ADD COLUMN IF NOT EXISTS "requiere_dos_pasos" BOOLEAN NOT NULL DEFAULT false;
