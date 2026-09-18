import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, uniqueSuffix } from './utils/test-app.js';
import { loginAsAdmin } from './utils/auth.js';

// HU03 (Motor de Reglas) + HU04 (Interfaz administrativa de configuración
// paramétrica): las reglas de depreciación se configuran como un JSON
// versionado, y solo la última versión creada queda "activa".
describe('HU03/HU04 Motor de Reglas de Depreciación', () => {
  let app: INestApplication;
  let adminToken: string;
  let campoToken: string;
  const suffix = uniqueSuffix();
  const grupoContable = `Equipos E2E ${suffix}`;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAsAdmin(app);

    const campoEmail = `campo.reglas.${suffix}@uagrm.edu.bo`;
    await request(app.getHttpServer())
      .post('/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Campo Reglas', email: campoEmail, password: 'ClaveSegura2026!', rol: 'CAMPO' });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: campoEmail, password: 'ClaveSegura2026!' });
    campoToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('un usuario con rol Campo no puede configurar reglas de depreciación', async () => {
    const res = await request(app.getHttpServer())
      .post('/reglas/configuracion')
      .set('Authorization', `Bearer ${campoToken}`)
      .send({
        reglas: [{ grupoContable, vidaUtilAnios: 4, valorResidualPorcentaje: 0 }],
        resolucion: 'Resolución de prueba',
      });

    expect(res.status).toBe(403);
  });

  it('el sistema rechaza una configuración sin ninguna regla', async () => {
    const res = await request(app.getHttpServer())
      .post('/reglas/configuracion')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reglas: [], resolucion: 'Resolución de prueba' });

    expect(res.status).toBe(400);
  });

  it('un admin puede crear una configuración de reglas por grupo contable', async () => {
    const res = await request(app.getHttpServer())
      .post('/reglas/configuracion')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reglas: [{ grupoContable, vidaUtilAnios: 4, valorResidualPorcentaje: 0 }],
        reglaPorDefecto: { vidaUtilAnios: 10, valorResidualPorcentaje: 0 },
        resolucion: `Resolución E2E ${suffix}`,
        descripcion: 'Configuración de prueba end-to-end',
      });

    expect(res.status).toBe(201);
    expect(res.body.activa).toBe(true);
    expect(res.body.reglas.reglas[0].grupoContable).toBe(grupoContable);
  });

  it('la configuración creada queda como la activa al consultarla', async () => {
    const res = await request(app.getHttpServer())
      .get('/reglas/configuracion')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.activa).toBe(true);
    expect(res.body.reglas.reglas.some((r: any) => r.grupoContable === grupoContable)).toBe(true);
  });

  it('crear una nueva configuración desactiva la anterior y sube de versión', async () => {
    const anterior = await request(app.getHttpServer())
      .get('/reglas/configuracion')
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app.getHttpServer())
      .post('/reglas/configuracion')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reglas: [{ grupoContable, vidaUtilAnios: 5, valorResidualPorcentaje: 10 }],
        resolucion: `Resolución E2E v2 ${suffix}`,
      });

    expect(res.status).toBe(201);
    expect(res.body.version).toBe(anterior.body.version + 1);

    const historial = await request(app.getHttpServer())
      .get('/reglas/configuracion/historial')
      .set('Authorization', `Bearer ${adminToken}`);

    const previa = historial.body.find((c: any) => c.id === anterior.body.id);
    expect(previa.activa).toBe(false);
  });

  it('un usuario no autenticado no puede consultar la configuración', async () => {
    const res = await request(app.getHttpServer()).get('/reglas/configuracion');
    expect(res.status).toBe(401);
  });
});

describe('HU03 Cálculo de depreciación de un activo', () => {
  let app: INestApplication;
  let adminToken: string;
  const suffix = uniqueSuffix();
  const grupoContable = `Depreciable E2E ${suffix}`;
  let activoId: string;
  let fechaAlta: Date;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAsAdmin(app);

    await request(app.getHttpServer())
      .post('/reglas/configuracion')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reglas: [{ grupoContable, vidaUtilAnios: 4, valorResidualPorcentaje: 0 }],
        resolucion: `Resolución depreciación ${suffix}`,
      });

    const creado = await request(app.getHttpServer())
      .post('/activos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        codigo: `UAGRM-E2E-DEP-${suffix}`,
        descripcion: 'Activo depreciable de prueba',
        grupoContable,
        ubicacion: 'Laboratorio E2E',
        estado: 'BUENO',
        valor: 4000,
      });

    activoId = creado.body.id;
    fechaAlta = new Date(creado.body.fechaAlta);
  });

  afterAll(async () => {
    await app.close();
  });

  it('a mitad de la vida útil, la depreciación acumulada es ~50% del valor', async () => {
    const fechaCalculo = new Date(fechaAlta.getTime() + 2 * 365.25 * 24 * 60 * 60 * 1000);

    const res = await request(app.getHttpServer())
      .get(`/activos/${activoId}/depreciacion?fecha=${fechaCalculo.toISOString()}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.valorActual).toBeCloseTo(2000, 0);
    expect(res.body.depreciacionAcumulada).toBeCloseTo(2000, 0);
    expect(res.body.totalmenteDepreciado).toBe(false);
  });

  it('pasada la vida útil completa, el activo queda totalmente depreciado', async () => {
    const fechaCalculo = new Date(fechaAlta.getTime() + 6 * 365.25 * 24 * 60 * 60 * 1000);

    const res = await request(app.getHttpServer())
      .get(`/activos/${activoId}/depreciacion?fecha=${fechaCalculo.toISOString()}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.valorActual).toBeCloseTo(0, 0);
    expect(res.body.totalmenteDepreciado).toBe(true);
  });

  it('un grupo contable sin regla configurada ni regla por defecto es rechazado', async () => {
    const creado = await request(app.getHttpServer())
      .post('/activos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        codigo: `UAGRM-E2E-SINREGLA-${suffix}`,
        descripcion: 'Activo sin regla configurada',
        grupoContable: `Grupo Inexistente ${suffix}`,
        ubicacion: 'Laboratorio E2E',
        estado: 'BUENO',
        valor: 1000,
      });

    const res = await request(app.getHttpServer())
      .get(`/activos/${creado.body.id}/depreciacion`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});
