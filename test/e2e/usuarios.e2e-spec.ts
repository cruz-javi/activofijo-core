import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, uniqueSuffix } from './utils/test-app.js';
import { loginAsAdmin } from './utils/auth.js';

// Reproduce las pruebas implícitas de "CU02 Gestionar Usuarios" (HU1-02):
// el documento no incluyó una tabla de caja negra para esta HU, pero sí
// definió sus criterios de aceptación explícitamente.
describe('CU02 Gestionar Usuarios', () => {
  let app: INestApplication;
  let adminToken: string;
  const suffix = uniqueSuffix();
  const email = `oficina.${suffix}@uagrm.edu.bo`;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAsAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('se debe poder crear un usuario asignándole un rol específico', async () => {
    const res = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Funcionaria de Oficina', email, password: 'Temporal2026!', rol: 'OFICINA' });

    expect(res.status).toBe(201);
    expect(res.body.rol).toBe('OFICINA');
    expect(res.body.activo).toBe(true);
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('el sistema debe rechazar correos duplicados', async () => {
    const res = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Otro', email, password: 'Temporal2026!', rol: 'CAMPO' });

    expect(res.status).toBe(409);
  });

  it('el sistema debe rechazar correos con formato no institucional', async () => {
    const res = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Otro', email: `externo.${suffix}@gmail.com`, password: 'Temporal2026!', rol: 'CAMPO' });

    expect(res.status).toBe(400);
  });

  it('el sistema debe permitir editar el rol de un usuario existente', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/usuarios')
      .set('Authorization', `Bearer ${adminToken}`);
    const creado = listRes.body.find((u: any) => u.email === email);

    const res = await request(app.getHttpServer())
      .patch(`/usuarios/${creado.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rol: 'CAMPO' });

    expect(res.status).toBe(200);
    expect(res.body.rol).toBe('CAMPO');
  });

  it('las cuentas no se eliminan de la base de datos, solo se marcan como inactivas', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/usuarios')
      .set('Authorization', `Bearer ${adminToken}`);
    const creado = listRes.body.find((u: any) => u.email === email);

    const bajaRes = await request(app.getHttpServer())
      .patch(`/usuarios/${creado.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ activo: false });

    expect(bajaRes.status).toBe(200);
    expect(bajaRes.body.activo).toBe(false);

    const listAfter = await request(app.getHttpServer())
      .get('/usuarios')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listAfter.body.some((u: any) => u.id === creado.id)).toBe(true);
  });

  it('un usuario dado de baja no debe poder iniciar sesión', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'Temporal2026!' });

    expect(res.status).toBe(401);
  });
});
