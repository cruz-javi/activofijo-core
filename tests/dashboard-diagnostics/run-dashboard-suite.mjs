/**
 * SUITE DE PRUEBAS DE CAJA NEGRA — DASHBOARD DE MÉTRICAS REALES Y GRÁFICOS
 * Sistema de Gestión de Activo Fijo — U.A.G.R.M.
 *
 * Módulo: Patrimonio / Dashboard
 * Ejecución:
 *   node tests/dashboard-diagnostics/run-dashboard-suite.mjs
 */

import 'dotenv/config';
import pg from 'pg';
import argon2 from 'argon2';
import { generate } from 'otplib';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const WEB_URL = process.env.WEB_URL || 'http://localhost:3001';
const PASSWORD_TEST = 'TestDash#Clave2026';
const RUN_ID = Date.now();

const db = new pg.Client({
  connectionString: process.env.DIRECT_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const resultados = [];
const creados = [];

function registrar(id, descripcion, aprobado, latenciaMs = 0, detalle = '') {
  resultados.push({ id, descripcion, aprobado, latenciaMs, detalle });
  const icono = aprobado ? '✅' : '❌';
  console.log(`${icono} [${id}] ${descripcion} (${latenciaMs} ms)${detalle ? ` — ${detalle}` : ''}`);
}

async function loginUsuario(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador: email, password }),
  });
  const json = await res.json();
  return { status: res.status, data: json };
}

async function activar2faSiEsRequerido(loginResult, email) {
  if (loginResult.data?.requiereConfiguracion2fa && loginResult.data?.desafioToken) {
    const { desafioToken } = loginResult.data;
    const configRes = await fetch(`${BASE_URL}/auth/2fa/inicial/configurar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ desafioToken }),
    });
    const configData = await configRes.json();
    const codigoOtp = await generate({ secret: configData.secreto });

    const activarRes = await fetch(`${BASE_URL}/auth/2fa/inicial/activar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ desafioToken, codigo: codigoOtp }),
    });
    const activarData = await activarRes.json();
    return activarData.sesion?.accessToken || activarData.accessToken;
  }
  return loginResult.data?.accessToken;
}

async function main() {
  console.log('='.repeat(75));
  console.log('  DIAGNÓSTICO DE CAJA NEGRA: DASHBOARD DE MÉTRICAS REALES Y GRÁFICOS');
  console.log('='.repeat(75));

  await db.connect();

  try {
    // 1. Crear usuario de prueba con rol JEFE_ACTIVO_FIJO
    const testEmail = `test.dashboard.${RUN_ID}@uagrm.edu.bo`;
    const passwordHash = await argon2.hash(PASSWORD_TEST);
    const userRes = await db.query(
      `INSERT INTO core.auth_usuario (email, password_hash, nombre_completo)
       VALUES ($1, $2, $3) RETURNING id`,
      [testEmail, passwordHash, 'Auditor de Dashboard Suite']
    );
    const userId = userRes.rows[0].id;
    creados.push(userId);

    await db.query(
      `INSERT INTO core.auth_usuario_rol (usuario_id, rol_id)
       VALUES ($1, 'JEFE_ACTIVO_FIJO')`,
      [userId]
    );

    // CP-DASH-01: Control de Acceso sin Autenticación
    const t0 = performance.now();
    const unauthRes = await fetch(`${BASE_URL}/activos/resumen-dashboard`);
    const latenciaUnauth = Math.round(performance.now() - t0);
    registrar(
      'CP-DASH-01',
      'Denegación estricta 401 Unauthorized sin token JWT en /activos/resumen-dashboard',
      unauthRes.status === 401,
      latenciaUnauth,
      `HTTP ${unauthRes.status}`
    );

    // Iniciar sesión y obtener JWT
    const login = await loginUsuario(testEmail, PASSWORD_TEST);
    const token = await activar2faSiEsRequerido(login, testEmail);

    if (!token) {
      throw new Error('No se pudo obtener token de autenticación para la suite');
    }

    // CP-DASH-02: Consulta Exitosa del Endpoint Resumen Dashboard
    const t1 = performance.now();
    const authRes = await fetch(`${BASE_URL}/activos/resumen-dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const latenciaAuth = Math.round(performance.now() - t1);
    const data = await authRes.json();

    registrar(
      'CP-DASH-02',
      'Acceso autorizado HTTP 200 con payload completo de resumen dashboard',
      authRes.status === 200 && data && typeof data === 'object',
      latenciaAuth,
      `HTTP ${authRes.status}`
    );

    // CP-DASH-03: Validación de KPIs Numéricos Consolidados
    const kpis = data.kpis;
    const kpisValidos =
      kpis &&
      typeof kpis.totalActivos === 'number' &&
      kpis.totalActivos >= 0 &&
      typeof kpis.valorTotalInventario === 'number' &&
      kpis.valorTotalInventario >= 0 &&
      typeof kpis.totalAsignados === 'number' &&
      kpis.totalAsignados >= 0 &&
      typeof kpis.porcentajeOperativos === 'number' &&
      kpis.porcentajeOperativos >= 0 &&
      kpis.porcentajeOperativos <= 100 &&
      typeof kpis.totalEtiquetasVigentes === 'number';

    registrar(
      'CP-DASH-03',
      'Métricas de KPIs reales coherentes y validadas',
      kpisValidos,
      latenciaAuth,
      `Total: ${kpis?.totalActivos}, Valor: Bs. ${kpis?.valorTotalInventario}, Asignados: ${kpis?.totalAsignados}, Operativos: ${kpis?.porcentajeOperativos}%`
    );

    // CP-DASH-04: Top Grupos Contables Proporcional
    const grupos = data.grupos;
    const gruposValidos =
      Array.isArray(grupos) &&
      grupos.length <= 5 &&
      grupos.every(
        (g) =>
          typeof g.codigo === 'number' &&
          typeof g.nombre === 'string' &&
          g.nombre.length > 0 &&
          typeof g.cantidad === 'number' &&
          typeof g.valor === 'number' &&
          typeof g.porcentaje === 'number'
      );

    // Verificar orden descendente por valor
    let ordenDescendente = true;
    for (let i = 1; i < grupos.length; i++) {
      if (grupos[i].valor > grupos[i - 1].valor) {
        ordenDescendente = false;
        break;
      }
    }

    registrar(
      'CP-DASH-04',
      'Estructura y ordenamiento por valor del Top 5 de Grupos Contables',
      gruposValidos && ordenDescendente,
      latenciaAuth,
      `${grupos?.length} grupos reportados`
    );

    // CP-DASH-05: Distribución de Estados Físicos y Mapeo Semántico UAGRM
    const estados = data.estados;
    const tonesValidos = ['brand', 'accent', 'danger', 'neutral', 'success'];
    const estadosValidos =
      Array.isArray(estados) &&
      estados.every(
        (e) =>
          typeof e.estado === 'string' &&
          typeof e.cantidad === 'number' &&
          typeof e.porcentaje === 'number' &&
          tonesValidos.includes(e.colorTone)
      );

    registrar(
      'CP-DASH-05',
      'Distribución de estados físicos con tones institucionales UAGRM válidos',
      estadosValidos,
      latenciaAuth,
      `${estados?.length} estados clasificados`
    );

    // CP-DASH-06: Incorporaciones Recientes al Patrimonio
    const recientes = data.recientes;
    const recientesValidos =
      Array.isArray(recientes) &&
      recientes.length <= 5 &&
      recientes.every(
        (r) =>
          typeof r.id === 'string' &&
          typeof r.codigo === 'string' &&
          typeof r.descripcion === 'string' &&
          typeof r.grupo === 'string' &&
          typeof r.valor === 'number' &&
          typeof r.estado === 'string' &&
          typeof r.fechaAlta === 'string' &&
          !isNaN(Date.parse(r.fechaAlta))
      );

    registrar(
      'CP-DASH-06',
      'Últimas 5 incorporaciones patrimoniales con datos completos y fecha ISO',
      recientesValidos,
      latenciaAuth,
      `${recientes?.length} registros recientes`
    );

    // CP-DASH-07: Verificación de Latencia de Consolidación (Régimen Continuo)
    const tWarm = performance.now();
    const warmRes = await fetch(`${BASE_URL}/activos/resumen-dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const latenciaWarm = Math.round(performance.now() - tWarm);
    registrar(
      'CP-DASH-07',
      'Benchmark de latencia agregada del dashboard en régimen continuo (< 1,500 ms)',
      warmRes.status === 200 && latenciaWarm < 1500,
      latenciaWarm,
      `Cold: ${latenciaAuth} ms, Warm: ${latenciaWarm} ms (umbral: 1500 ms)`
    );

    // CP-DASH-08: Verificación a través del Proxy BFF Web de Next.js
    const tProxy = performance.now();
    const proxyRes = await fetch(`${WEB_URL}/api/proxy/activos/resumen-dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const latenciaProxy = Math.round(performance.now() - tProxy);
    const proxyData = await proxyRes.json();
    registrar(
      'CP-DASH-08',
      'Consumo transparente a través del BFF Web Proxy de Next.js (/api/proxy/...)',
      proxyRes.status === 200 && proxyData?.kpis?.totalActivos === data.kpis.totalActivos,
      latenciaProxy,
      `HTTP ${proxyRes.status}, Total Activos: ${proxyData?.kpis?.totalActivos}`
    );

    // Resumen
    const aprobados = resultados.filter((r) => r.aprobado).length;
    console.log('\n' + '='.repeat(75));
    console.log(`  RESULTADO FINAL: ${aprobados}/${resultados.length} CASOS APROBADOS`);
    console.log('='.repeat(75));

    if (aprobados === resultados.length) {
      console.log('✨ TODAS LAS PRUEBAS DEL DASHBOARD PASARON SATISFACTORIAMENTE.');
    } else {
      console.error('❌ SE DETECTARON DEFECTOS EN LAS PRUEBAS.');
      process.exitCode = 1;
    }
  } finally {
    // Limpieza segura de usuarios de prueba y claves foráneas
    if (creados.length > 0) {
      try {
        await db.query(
          `UPDATE core.auth_usuario SET activo = false WHERE id = ANY($1::uuid[])`,
          [creados]
        );
      } catch (err) {
        console.warn('Advertencia al limpiar datos temporales:', err.message);
      }
    }
    await db.end();
  }
}

main().catch((err) => {
  console.error('Error no controlado en la ejecución:', err);
  process.exit(1);
});
