/**
 * PRUEBAS DE CONTRATO — CLIENTE MÓVIL (activofijo-app/src/lib/auth-api.ts) CONTRA EL CORE
 * Plan: docs/plans/plan-identidad-autenticacion-totp.md (Paso 6)
 *
 * Ejecuta el mismo módulo que usa la app Expo, sin emulador (requiere tsx):
 *   API_URL=http://localhost:3000 npx tsx tests/2fa-diagnostics/run-cliente-movil-suite.mjs
 *
 * Crea usuarios `test.2fa.*` y los deja inactivos al terminar.
 */
import 'dotenv/config';
import argon2 from 'argon2';
import pg from 'pg';
import { generate } from 'otplib';
import { crearClienteAuth, esDesafio, ErrorAutenticacion } from '../../../activofijo-app/src/lib/auth-api.ts';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const PASSWORD = 'Test2fa#Clave2026';
const RUN_ID = Date.now();
const casos = [];

const api = crearClienteAuth(API_URL);
const db = new pg.Client({ connectionString: process.env.DIRECT_DATABASE_URL, ssl: { rejectUnauthorized: false } });

function registrar(id, descripcion, aprobado, detalle = '') {
  casos.push({ id, aprobado });
  console.log(`${aprobado ? '✅' : '❌'} ${id}: ${descripcion}${detalle ? ` — ${detalle}` : ''}`);
}

async function crearUsuario(rol) {
  const email = `test.2fa.${RUN_ID}.movil.${rol.toLowerCase()}@uagrm.edu.bo`;
  const { rows } = await db.query(
    'INSERT INTO core.auth_usuario (email, password_hash, nombre_completo) VALUES ($1, $2, $3) RETURNING id',
    [email, await argon2.hash(PASSWORD), `Prueba móvil 2FA ${rol}`],
  );
  await db.query('INSERT INTO core.auth_usuario_rol (usuario_id, rol_id) VALUES ($1, $2)', [rows[0].id, rol]);
  return { id: rows[0].id, email };
}

async function fallaCon(promesa, estadoEsperado) {
  try {
    await promesa;
    return false;
  } catch (error) {
    return error instanceof ErrorAutenticacion && error.status === estadoEsperado;
  }
}

const creados = [];
await db.connect();

try {
  const jefe = await crearUsuario('JEFE_ACTIVO_FIJO');
  creados.push(jefe);

  const login = await api.iniciarSesion(jefe.email, PASSWORD, 'movil-test');
  registrar('MOV-2FA-01', 'Un rol obligatorio sin 2FA recibe el desafío de configuración', esDesafio(login) && 'requiereConfiguracion2fa' in login);

  const configuracion = await api.configurarInicial(login.desafioToken);
  registrar('MOV-2FA-02', 'La configuración inicial entrega clave y enlace otpauth para abrir la aplicación',
    configuracion.otpauthUri.startsWith('otpauth://totp/') && configuracion.secreto.length >= 16);

  registrar('MOV-2FA-03', 'Activar con un código incorrecto lanza ErrorAutenticacion 401',
    await fallaCon(api.activarInicial(login.desafioToken, '000000'), 401));

  const activacion = await api.activarInicial(login.desafioToken, await generate({ secret: configuracion.secreto }));
  registrar('MOV-2FA-04', 'Activar con código válido devuelve la sesión y 10 códigos de respaldo',
    !!activacion.sesion.accessToken && !!activacion.sesion.refreshToken && activacion.codigosRespaldo.length === 10);

  const segundo = await api.iniciarSesion(jefe.email, PASSWORD, 'movil-test');
  registrar('MOV-2FA-05', 'Con 2FA activo el login pide el segundo paso', esDesafio(segundo) && 'requiere2fa' in segundo);

  registrar('MOV-2FA-06', 'Un código incorrecto en el segundo paso lanza 401',
    await fallaCon(api.verificarCodigo(segundo.desafioToken, '000000'), 401));

  const codigoFuturo = await generate({ secret: configuracion.secreto, epoch: Math.floor(Date.now() / 1000) + 30 });
  const sesion = await api.verificarCodigo(segundo.desafioToken, codigoFuturo);
  registrar('MOV-2FA-07', 'Un código válido en el segundo paso devuelve la sesión', !!sesion.accessToken && sesion.user.email === jefe.email);

  const funcionario = await crearUsuario('FUNCIONARIO');
  creados.push(funcionario);
  const directo = await api.iniciarSesion(funcionario.email, PASSWORD, 'movil-test');
  registrar('MOV-2FA-08', 'Un FUNCIONARIO sin 2FA entra directo con el formato de sesión de siempre', !esDesafio(directo) && !!directo.accessToken);

  registrar('MOV-2FA-09', 'Credenciales inválidas lanzan 401 con el mensaje genérico',
    await fallaCon(api.iniciarSesion(funcionario.email, 'otra-clave', 'movil-test'), 401));
} catch (error) {
  registrar('MOV-2FA-ERR', 'La suite terminó sin errores inesperados', false, error.stack || error.message);
} finally {
  if (creados.length > 0) {
    await db.query("UPDATE core.auth_usuario SET activo = false, estado = 'INACTIVO' WHERE id = ANY($1)", [creados.map((u) => u.id)]);
  }
  await db.end();
}

const aprobados = casos.filter((c) => c.aprobado).length;
console.log(`\nResultado: ${aprobados}/${casos.length} casos aprobados`);
process.exit(aprobados === casos.length ? 0 : 1);
