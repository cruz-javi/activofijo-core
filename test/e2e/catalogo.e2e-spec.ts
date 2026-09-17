import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, uniqueSuffix } from './utils/test-app.js';
import { loginAsAdmin } from './utils/auth.js';

describe('CU03 Consultar Catálogo de Activos', () => {
  let app: INestApplication;
  let adminToken: string;
  const suffix = uniqueSuffix();
  const codigo = `UAGRM-E2E-${suffix}`;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAsAdmin(app);

    await request(app.getHttpServer())
      .post('/activos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        codigo,
        descripcion: 'Proyector de prueba E2E',
        grupoContable: 'Audiovisuales',
        ubicacion: `Laboratorio E2E ${suffix}`,
        estado: 'REGULAR',
        valor: 4200,
      });
  });

  afterAll(async () => {
    await app.close();
  });

  it('un usuario no autenticado no debe poder acceder al catálogo', async () => {
    const res = await request(app.getHttpServer()).get('/activos');
    expect(res.status).toBe(401);
  });

  it('la búsqueda por código debe encontrar el activo recién creado', async () => {
    const res = await request(app.getHttpServer())
      .get(`/activos?search=${codigo}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.some((a: any) => a.codigo === codigo)).toBe(true);
  });

  it('el filtro por ubicación debe restringir los resultados', async () => {
    const res = await request(app.getHttpServer())
      .get(`/activos?ubicacion=${encodeURIComponent(`Laboratorio E2E ${suffix}`)}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.every((a: any) => a.ubicacion.includes(`Laboratorio E2E ${suffix}`))).toBe(true);
  });

  it('el filtro por estado combinado con búsqueda no debe devolver resultados si no coincide', async () => {
    const res = await request(app.getHttpServer())
      .get(`/activos?search=${codigo}&estado=EXCELENTE`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });
});

describe('CU05 Gestionar Registro Manual de Activo', () => {
  let app: INestApplication;
  let adminToken: string;
  let campoToken: string;
  const suffix = uniqueSuffix();
  const codigo = `UAGRM-E2E-CU05-${suffix}`;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAsAdmin(app);

    const campoEmail = `campo.cu05.${suffix}@uagrm.edu.bo`;
    await request(app.getHttpServer())
      .post('/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Campo CU05', email: campoEmail, password: 'ClaveSegura2026!', rol: 'CAMPO' });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: campoEmail, password: 'ClaveSegura2026!' });
    campoToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('PCN-01: alta manual exitosa crea el activo correctamente', async () => {
    const res = await request(app.getHttpServer())
      .post('/activos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        codigo,
        descripcion: 'Silla ergonómica de prueba',
        grupoContable: 'Mobiliario',
        ubicacion: 'Facultad de Ingeniería',
        estado: 'BUENO',
        valor: 350,
      });

    expect(res.status).toBe(201);
    expect(res.body.codigo).toBe(codigo);
    expect(res.body.version).toBe(1);
  });

  it('PCN-02: campos obligatorios incompletos rechazan el registro', async () => {
    const res = await request(app.getHttpServer())
      .post('/activos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ codigo: `${codigo}-incompleto`, descripcion: 'Impresora' });

    expect(res.status).toBe(400);
  });

  it('PCN-03: la edición de un activo existente actualiza el registro y sube la versión', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/activos/${await findId(app, adminToken, codigo)}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ubicacion: 'Facultad de Humanidades', expectedVersion: 1 });

    expect(res.status).toBe(200);
    expect(res.body.ubicacion).toBe('Facultad de Humanidades');
    expect(res.body.version).toBe(2);
  });

  it('PCN-04: el activo editado se refleja de inmediato en el catálogo', async () => {
    const res = await request(app.getHttpServer())
      .get(`/activos?search=${codigo}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const encontrado = res.body.data.find((a: any) => a.codigo === codigo);
    expect(encontrado).toBeDefined();
    expect(encontrado.ubicacion).toBe('Facultad de Humanidades');
  });

  it('PCN-05: un usuario con rol Campo no puede registrar activos manualmente', async () => {
    const res = await request(app.getHttpServer())
      .post('/activos')
      .set('Authorization', `Bearer ${campoToken}`)
      .send({
        codigo: `${codigo}-campo`,
        descripcion: 'Silla',
        grupoContable: 'Mobiliario',
        ubicacion: 'FICCT',
        valor: 100,
      });

    expect(res.status).toBe(403);
  });
});

async function findId(app: INestApplication, token: string, codigo: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .get(`/activos?search=${codigo}`)
    .set('Authorization', `Bearer ${token}`);
  const item = res.body.data.find((a: any) => a.codigo === codigo);
  if (!item) throw new Error(`No se encontró el activo de prueba ${codigo}`);
  return item.id;
}
