/**
 * PRUEBAS DE CAJA NEGRA — FLUJO WEB (BFF de Next.js) DE VERIFICACIÓN EN DOS PASOS
 * Plan: docs/plans/plan-identidad-autenticacion-totp.md (Paso 5)
 *
 * Uso (core y web levantados):
 *   WEB_URL=http://localhost:3001 node tests/2fa-diagnostics/run-bff-web-suite.mjs
 *
 * Simula un navegador con un jar de cookies. Crea usuarios `test.2fa.*` y los deja inactivos al terminar.
 */
import 'dotenv/config';
import argon2 from 'argon2';
import pg from 'pg';
import { generate } from 'otplib';

const WEB_URL = process.env.WEB_URL || 'http://localhost:3001';
const PASSWORD = 'Test2fa#Clave2026';
const RUN_ID = Date.now();
const casos = [];

const db = new pg.Client({ connectionString: process.env.DIRECT_DATABASE_URL, ssl: { rejectUnauthorized: false } });

function registrar(id, descripcion, aprobado, detalle = '') {
  casos.push({ id, aprobado });
  console.log(`${aprobado ? '✅' : '❌'} ${id}: ${descripcion}${detalle ? ` — ${detalle}` : ''}`);
}

class Navegador {
  constructor(ip) {
    this.cookies = new Map();
    this.ip = ip;
    this.setCookies = [];
  }

  async solicitar(metodo, ruta, cuerpo) {
    const inicio = performance.now();
    const res = await fetch(`${WEB_URL}${ruta}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': this.ip,
        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    this.setCookies = res.headers.getSetCookie();
    for (const linea of this.setCookies) {
      const [par] = linea.split(';');
      const [nombre, ...valor] = par.split('=');
      if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(linea) || valor.join('=') === '') this.cookies.delete(nombre);
      else this.cookies.set(nombre, valor.join('='));
    }
    const texto = await res.text();
    let datos = null;
    try { datos = texto ? JSON.parse(texto) : null; } catch { datos = { texto }; }
    return { estado: res.status, datos, ms: Math.round(performance.now() - inicio), cabeceras: res.headers };
  }

  cookieSet(nombre) {
    return this.setCookies.find((linea) => linea.startsWith(`${nombre}=`));
  }
}

async function crearUsuario(rol) {
  const email = `test.2fa.${RUN_ID}.web.${rol.toLowerCase()}@uagrm.edu.bo`;
  const { rows } = await db.query(
    'INSERT INTO core.auth_usuario (email, password_hash, nombre_completo) VALUES ($1, $2, $3) RETURNING id',
    [email, await argon2.hash(PASSWORD), `Prueba web 2FA ${rol}`],
  );
  await db.query('INSERT INTO core.auth_usuario_rol (usuario_id, rol_id) VALUES ($1, $2)', [rows[0].id, rol]);
  return { id: rows[0].id, email };
}

const futuro = (secreto) => generate({ secret: secreto, epoch: Math.floor(Date.now() / 1000) + 30 });

const creados = [];
await db.connect();

try {
  const jefe = await crearUsuario('JEFE_ACTIVO_FIJO');
  creados.push(jefe);
  const navegador = new Navegador(`10.30.${RUN_ID % 200}.1`);

  const login = await navegador.solicitar('POST', '/api/auth/login', { identificador: jefe.email, password: PASSWORD });
  const cookieDesafio = navegador.cookieSet('af_desafio_2fa');
  registrar('WEB-2FA-01', 'El login de un rol obligatorio pide configurar y no crea sesión',
    login.estado === 200 && login.datos?.requiereConfiguracion2fa === true && !navegador.cookies.has('af_access_token') && !login.datos?.desafioToken, `HTTP ${login.estado}`);

  registrar('WEB-2FA-02', 'El desafío viaja en una cookie HttpOnly limitada a /api/auth/2fa',
    !!cookieDesafio && /HttpOnly/i.test(cookieDesafio) && /Path=\/api\/auth\/2fa/i.test(cookieDesafio) && /SameSite=strict/i.test(cookieDesafio), cookieDesafio ? '' : 'sin cookie');

  const configuracion = await navegador.solicitar('POST', '/api/auth/2fa/inicial/configurar');
  registrar('WEB-2FA-03', 'Configuración inicial entrega clave y URI sin caché',
    configuracion.estado === 201 && configuracion.datos?.otpauthUri?.startsWith('otpauth://totp/') && /no-store/.test(configuracion.cabeceras.get('cache-control') || ''), `HTTP ${configuracion.estado}`);
  const secreto = configuracion.datos.secreto;

  const activarMal = await navegador.solicitar('POST', '/api/auth/2fa/inicial/activar', { codigo: '000000' });
  registrar('WEB-2FA-04', 'Activar con un código incorrecto responde 401 y no crea sesión', activarMal.estado === 401 && !navegador.cookies.has('af_access_token'), `HTTP ${activarMal.estado}`);

  const activar = await navegador.solicitar('POST', '/api/auth/2fa/inicial/activar', { codigo: await generate({ secret: secreto }) });
  registrar('WEB-2FA-05', 'Activar con código válido crea la sesión, entrega 10 códigos de respaldo y limpia el desafío',
    activar.estado === 200 && activar.datos?.codigosRespaldo?.length === 10 && navegador.cookies.has('af_access_token') && !navegador.cookies.has('af_desafio_2fa'), `HTTP ${activar.estado}, ${activar.ms} ms`);

  const perfil = await navegador.solicitar('GET', '/api/auth/me');
  registrar('WEB-2FA-06', 'El perfil indica 2FA activo y obligatorio', perfil.estado === 200 && perfil.datos?.dosFactoresActivo === true && perfil.datos?.dosFactoresObligatorio === true, `HTTP ${perfil.estado}`);

  await navegador.solicitar('POST', '/api/auth/logout');
  const segundoLogin = await navegador.solicitar('POST', '/api/auth/login', { identificador: jefe.email, password: PASSWORD });
  registrar('WEB-2FA-07', 'Con 2FA activo el login pide el segundo paso', segundoLogin.datos?.requiere2fa === true && !navegador.cookies.has('af_access_token'), `HTTP ${segundoLogin.estado}`);

  const incorrecto = await navegador.solicitar('POST', '/api/auth/2fa/verificar', { codigo: '000000' });
  registrar('WEB-2FA-08', 'Código incorrecto responde 401 y conserva el desafío para reintentar', incorrecto.estado === 401 && navegador.cookies.has('af_desafio_2fa'), `HTTP ${incorrecto.estado}`);

  const correcto = await navegador.solicitar('POST', '/api/auth/2fa/verificar', { codigo: await futuro(secreto) });
  registrar('WEB-2FA-09', 'Código válido crea la sesión y limpia el desafío',
    correcto.estado === 200 && navegador.cookies.has('af_access_token') && !navegador.cookies.has('af_desafio_2fa'), `HTTP ${correcto.estado}, ${correcto.ms} ms`);

  const proxy = await navegador.solicitar('GET', '/api/proxy/auth/me');
  registrar('WEB-2FA-10', 'La sesión creada funciona en las rutas protegidas del proxy', proxy.estado === 200, `HTTP ${proxy.estado}`);

  const otro = new Navegador(`10.30.${RUN_ID % 200}.2`);
  const sinDesafio = await otro.solicitar('POST', '/api/auth/2fa/verificar', { codigo: '123456' });
  registrar('WEB-2FA-11', 'Verificar sin haber iniciado sesión responde 401', sinDesafio.estado === 401, `HTTP ${sinDesafio.estado}`);

  const sinDesafioConfig = await otro.solicitar('POST', '/api/auth/2fa/inicial/configurar');
  registrar('WEB-2FA-12', 'Configurar sin desafío responde 401', sinDesafioConfig.estado === 401, `HTTP ${sinDesafioConfig.estado}`);

  const funcionario = await crearUsuario('FUNCIONARIO');
  creados.push(funcionario);
  const navFuncionario = new Navegador(`10.30.${RUN_ID % 200}.3`);
  const loginFuncionario = await navFuncionario.solicitar('POST', '/api/auth/login', { identificador: funcionario.email, password: PASSWORD });
  registrar('WEB-2FA-13', 'FUNCIONARIO sin 2FA entra directamente (contrato del BFF intacto)',
    loginFuncionario.estado === 200 && navFuncionario.cookies.has('af_access_token') && !loginFuncionario.datos?.requiere2fa, `HTTP ${loginFuncionario.estado}, ${loginFuncionario.ms} ms`);

  const cfgProxy = await navFuncionario.solicitar('POST', '/api/proxy/auth/2fa/configurar');
  const actProxy = await navFuncionario.solicitar('POST', '/api/proxy/auth/2fa/activar', { codigo: await generate({ secret: cfgProxy.datos?.secreto }) });
  registrar('WEB-2FA-14', 'FUNCIONARIO activa el 2FA desde su cuenta (proxy autenticado)',
    cfgProxy.estado === 201 && actProxy.estado === 201 && actProxy.datos?.codigosRespaldo?.length === 10, `HTTP ${cfgProxy.estado}/${actProxy.estado}`);
} catch (error) {
  registrar('WEB-2FA-ERR', 'La suite terminó sin errores inesperados', false, error.stack || error.message);
} finally {
  if (creados.length > 0) {
    await db.query("UPDATE core.auth_usuario SET activo = false, estado = 'INACTIVO' WHERE id = ANY($1)", [creados.map((u) => u.id)]);
  }
  await db.end();
}

const aprobados = casos.filter((c) => c.aprobado).length;
console.log(`\nResultado: ${aprobados}/${casos.length} casos aprobados`);
process.exit(aprobados === casos.length ? 0 : 1);
