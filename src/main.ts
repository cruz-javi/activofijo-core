import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';

// Serializador global para BigInt en respuestas JSON de Express/NestJS
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};
import { AppModule } from './app.module.js';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  // Sin esto todos los usuarios que llegan por el BFF comparten IP (límites y auditoría). Ej.: TRUST_PROXY=loopback o 1.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    const valor = /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true' ? true : trustProxy;
    app.getHttpAdapter().getInstance().set('trust proxy', valor);
  }

  const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim());

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('UAGRM Activo Fijo Core API')
    .setDescription('Core API with Event Sourcing for UAGRM fixed asset management')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  try {
    fs.writeFileSync(
      path.resolve(process.cwd(), 'openapi.json'),
      JSON.stringify(document, null, 2),
      'utf-8',
    );
  } catch (err: any) {
    console.warn('Could not write openapi.json:', err.message);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`[INFO] Application listening on port ${port}`);
}

bootstrap();
