import { INestApplication } from '@nestjs/common';
import request from 'supertest';

export async function loginAsAdmin(app: INestApplication): Promise<string> {
  const email = process.env.INITIAL_ADMIN_EMAIL || 'admin@uagrm.edu.bo';
  const password = process.env.INITIAL_ADMIN_PASSWORD || 'AdminSecurePass123!';

  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password });

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`No se pudo autenticar como administrador semilla: ${JSON.stringify(res.body)}`);
  }

  return res.body.accessToken;
}
