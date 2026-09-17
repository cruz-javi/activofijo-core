import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, uniqueSuffix } from './utils/test-app.js';
import { loginAsAdmin } from './utils/auth.js';
import { PrismaCoreService } from '../../src/infrastructure/persistence/core/prisma-core.service.js';

// Reproduce las pruebas de caja negra "CU01 Autenticar Usuario" del documento
// Panel 1 (Sprint 1), corridas de verdad contra el backend en lugar de
// completadas a mano en una tabla.
describe('CU01 Autenticar Usuario', () => {
  let app: INestApplication;
  let adminToken: string;
  const suffix = uniqueSuffix();
  const campoEmail = `campo.${suffix}@uagrm.edu.bo`;
  const inactivoEmail = `inactivo.${suffix}@uagrm.edu.bo`;
  const password = 'ClaveSegura2026!';

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAsAdmin(app);

    await request(app.getHttpServer())
      .post('/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Inspector de Prueba', email: campoEmail, password, rol: 'CAMPO' });

    const inactivoRes = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Usuario Inactivo', email: inactivoEmail, password, rol: 'OFICINA' });

    await request(app.getHttpServer())
      .patch(`/usuarios/${inactivoRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ activo: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it('PCN-01: inicio de sesión exitoso genera un token de sesión válido', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      email: process.env.INITIAL_ADMIN_EMAIL || 'admin@uagrm.edu.bo',
      password: process.env.INITIAL_ADMIN_PASSWORD || 'AdminSecurePass123!',
    });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.user.rol).toBe('ADMIN');
  });

  it('PCN-02: campos obligatorios vacíos no generan token', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ email: '', password: '' });

    expect(res.status).toBe(400);
    expect(res.body.accessToken).toBeUndefined();
  });

  it('PCN-03: credenciales inválidas rechazan el acceso sin generar token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: campoEmail, password: 'contraseñaIncorrecta123' });

    expect(res.status).toBe(401);
    expect(res.body.accessToken).toBeUndefined();
  });

  it('PCN-04: un funcionario de Campo no puede acceder al panel de configuración (gestión de usuarios)', async () => {
    const loginRes = await request(app.getHttpServer()).post('/auth/login').send({ email: campoEmail, password });
    const campoToken = loginRes.body.accessToken;

    const res = await request(app.getHttpServer())
      .get('/usuarios')
      .set('Authorization', `Bearer ${campoToken}`);

    expect(res.status).toBe(403);
  });

  it('PCN-05: la contraseña se almacena encriptada, nunca en texto plano', async () => {
    const prisma = app.get(PrismaCoreService);
    const usuario = await prisma.usuario.findUnique({ where: { email: campoEmail } });

    expect(usuario?.passwordHash).toBeDefined();
    expect(usuario?.passwordHash).not.toBe(password);
    expect(usuario?.passwordHash.startsWith('$argon2id$')).toBe(true);
  });

  it('un usuario inactivo no puede iniciar sesión aunque sus credenciales sean correctas', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ email: inactivoEmail, password });

    expect(res.status).toBe(401);
  });

  it('cada intento de login (éxito y fallo) queda registrado en la auditoría de accesos', async () => {
    await request(app.getHttpServer()).post('/auth/login').send({ email: campoEmail, password: 'mala' });

    const prisma = app.get(PrismaCoreService);
    const intentos = await prisma.auditoriaAcceso.findMany({
      where: { email: campoEmail },
      orderBy: { fecha: 'desc' },
    });

    expect(intentos.length).toBeGreaterThan(0);
    expect(intentos.some((i) => i.exito === false)).toBe(true);
  });
});
