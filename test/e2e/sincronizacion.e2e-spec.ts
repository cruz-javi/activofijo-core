import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, createTestAppWithEnv, uniqueSuffix } from './utils/test-app.js';
import { loginAsAdmin } from './utils/auth.js';
import { insertLegacyBien } from './utils/legacy-db.js';

// Reproduce las pruebas de caja negra "CU04 Sincronizar Inventario Base"
// del documento Panel 1, contra el motor de sincronización real (antes
// de esta implementación, el flujo descrito en el documento no existía).
describe('CU04 Sincronizar Inventario Base', () => {
  let app: INestApplication;
  let adminToken: string;
  const suffix = uniqueSuffix();
  const codigoA = `AF-E2E-${suffix}-A`;
  const codigoB = `AF-E2E-${suffix}-B`;
  const descripcionSinCodigo = `Activo sin código legado ${suffix}`;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAsAdmin(app);

    await insertLegacyBien({
      codigoAntiguo: codigoA,
      descripcionBien: 'Escritorio metálico de prueba E2E',
      categoria: 'Mobiliario',
      ubicacionEdificio: 'Módulo E2E',
      ubicacionAula: 'Aula 1',
      responsableNombre: 'Responsable de Prueba',
      valorCompra: 900,
    });
    await insertLegacyBien({
      codigoAntiguo: codigoB,
      descripcionBien: 'Silla giratoria de prueba E2E',
      categoria: 'Mobiliario',
      ubicacionEdificio: 'Módulo E2E',
      ubicacionAula: 'Aula 2',
      responsableNombre: 'Responsable de Prueba',
      valorCompra: 300,
    });
    // Código legado en blanco: el servicio debe asignar un UUID de respaldo.
    await insertLegacyBien({
      codigoAntiguo: ' '.repeat((Date.now() % 7) + 2),
      descripcionBien: descripcionSinCodigo,
      categoria: 'Equipos de Computación',
      ubicacionEdificio: 'Módulo E2E',
      ubicacionAula: 'Aula 3',
      responsableNombre: 'Responsable de Prueba',
      valorCompra: 1200,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('PCN-01: la sincronización exitosa importa y mapea los registros nuevos', async () => {
    const res = await request(app.getHttpServer())
      .post('/sincronizacion/ejecutar')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('COMPLETADA');
    expect(res.body.registrosImportados).toBeGreaterThanOrEqual(3);

    const catalogo = await request(app.getHttpServer())
      .get(`/activos?search=${codigoA}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(catalogo.body.data.some((a: any) => a.codigo === codigoA)).toBe(true);
  });

  it('PCN-02: un activo sin código único recibe un UUID de respaldo automáticamente', async () => {
    const res = await request(app.getHttpServer())
      .get('/activos?search=LEGACY-&limit=200')
      .set('Authorization', `Bearer ${adminToken}`);

    const asignado = res.body.data.find((a: any) => a.descripcion === descripcionSinCodigo);
    expect(asignado).toBeDefined();
    expect(asignado.codigo.startsWith('LEGACY-')).toBe(true);
  });

  it('PCN-05: los activos importados aparecen de inmediato en el Catálogo de Activos', async () => {
    const res = await request(app.getHttpServer())
      .get(`/activos?search=${codigoB}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const encontrado = res.body.data.find((a: any) => a.codigo === codigoB);
    expect(encontrado).toBeDefined();
    expect(encontrado.descripcion).toBe('Silla giratoria de prueba E2E');
  });

  it('PCN-04: el sistema detecta duplicados por código legado y no crea registros repetidos', async () => {
    await request(app.getHttpServer())
      .post('/sincronizacion/ejecutar')
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app.getHttpServer())
      .get(`/activos?search=${codigoA}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const coincidencias = res.body.data.filter((a: any) => a.codigo === codigoA);
    expect(coincidencias.length).toBe(1);
  });

  it('PCN-03: si el origen de datos no está disponible, no se alteran los datos existentes', async () => {
    const antes = await request(app.getHttpServer())
      .get('/activos?limit=1')
      .set('Authorization', `Bearer ${adminToken}`);
    const totalAntes = antes.body.total;

    // Apunta el origen legado a un puerto cerrado para simular la caída de
    // conexión: un pool ya conectado no reacciona a un REVOKE posterior
    // (probado por separado), así que se necesita una app nueva con el
    // origen inalcanzable desde el arranque.
    const brokenApp = await createTestAppWithEnv({
      LEGACY_DATABASE_URL: 'postgresql://legacy_ro:legacy_ro_secret@127.0.0.1:59999/activofijo?schema=legacy_demo',
    });

    try {
      const brokenAdminToken = await loginAsAdmin(brokenApp);
      const res = await request(brokenApp.getHttpServer())
        .post('/sincronizacion/ejecutar')
        .set('Authorization', `Bearer ${brokenAdminToken}`);

      expect(res.status).toBe(503);

      const historial = await request(brokenApp.getHttpServer())
        .get('/sincronizacion/historial')
        .set('Authorization', `Bearer ${brokenAdminToken}`);
      expect(historial.body[0].estado).toBe('FALLIDA');
    } finally {
      await brokenApp.close();
    }

    const despues = await request(app.getHttpServer())
      .get('/activos?limit=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(despues.body.total).toBe(totalAntes);
  });
});
