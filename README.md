# activofijo-core — Backend Core & Event Store (UAGRM)

Módulo central de backend para la gestión de activos fijos de la Universidad Autónoma Gabriel René Moreno (UAGRM).

## Arquitectura

- **Framework**: NestJS 12 (ESM nativo).
- **Persistencia**: Arquitectura Hexagonal con puertos y adaptadores.
- **Modos de Datos (`DATA_SOURCE_MODE`)**:
  - `fresh`: Base de datos nueva, Event Sourcing append-only y proyecciones.
  - `legacy`: Lecturas directas de solo lectura sobre el esquema histórico `legacy_demo`.
  - `hybrid`: Lectura combinada e importación continua con eventos de trazabilidad.
- **ORM**: Prisma 7.10.0 (`@prisma/adapter-pg`).
- **Seguridad**: Argon2id, JWT con access tokens de 15m y refresh tokens opacos rotados con detección de reuso, RBAC (`ADMIN`, `INSPECTOR`).
- **Validación y Contratos**: Zod estricto + exportación automática de `openapi.json`.

## Requisitos previos

- Node.js >= 22.12 (Node 22 LTS)
- pnpm >= 10.x
- Docker y Docker Compose

## Arranque rápido

1. Clonar e instalar dependencias:
   ```bash
   pnpm install
   ```

2. Configurar variables de entorno:
   ```bash
   cp .env.example .env
   ```

3. Iniciar base de datos local con Docker:
   ```bash
   docker compose --profile local-db up -d
   ```

4. Ejecutar migraciones y generar clientes de base de datos:
   ```bash
   pnpm prisma:generate
   pnpm prisma:migrate:dev
   pnpm prisma:seed
   ```

5. Iniciar en modo desarrollo:
   ```bash
   pnpm dev
   ```

6. Verificar estado de salud:
   - Endpoint: `http://localhost:3000/health`
   - Documentación Swagger: `http://localhost:3000/api/docs`
