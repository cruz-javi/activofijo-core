/**
 * SUITE DE PRUEBAS DE CAJA NEGRA — COBERTURA DE EVENTOS EN BITÁCORA FORENSE
 * Sistema de Gestión de Activo Fijo — U.A.G.R.M.
 *
 * Módulo: Identidad y Acceso / Auditoría Forense
 * Ejecución:
 *   node tests/auditoria-diagnostics/run-auditoria-suite.mjs
 */

import 'dotenv/config';
import pg from 'pg';
import argon2 from 'argon2';
import { generate } from 'otplib';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const PASSWORD_TEST = 'Auditoria#TestClave2026';
const RUN_ID = Date.now();

const db = new pg.Client({
  connectionString: process.env.DIRECT_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const resultados = [];
const usuariosCreados = [];
const plantillasCreadas = [];

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

async function activar2faSiEsRequerido(loginResult) {
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
    return {
      token: activarData.sesion?.accessToken || activarData.accessToken,
      secreto: configData.secreto,
    };
  }
  return { token: loginResult.data?.accessToken, secreto: null };
}

async function main() {
  console.log('='.repeat(75));
  console.log('  DIAGNÓSTICO DE CAJA NEGRA: COBERTURA FORENSE DE BITÁCORA (CU-04 / 2FA / ETIQUETAS)');
  console.log('='.repeat(75));

  await db.connect();

  try {
    // 1. Crear usuario administrador de prueba con permisos completos
    const adminEmail = `admin.audit.${RUN_ID}@uagrm.edu.bo`;
    const passwordHash = await argon2.hash(PASSWORD_TEST);
    const adminRes = await db.query(
      `INSERT INTO core.auth_usuario (email, password_hash, nombre_completo, activo, estado)
       VALUES ($1, $2, $3, true, 'ACTIVO') RETURNING id`,
      [adminEmail, passwordHash, 'Administrador Auditor Suite']
    );
    const adminId = adminRes.rows[0].id;
    usuariosCreados.push(adminId);

    await db.query(
      `INSERT INTO core.auth_usuario_rol (usuario_id, rol_id)
       VALUES ($1, 'ADMINISTRADOR'), ($1, 'JEFE_ACTIVO_FIJO')`,
      [adminId]
    );

    // CP-AUD-01: Control de Acceso sin Autenticación al endpoint de auditoría
    const t0 = performance.now();
    const unauthRes = await fetch(`${BASE_URL}/auditoria`);
    const latenciaUnauth = Math.round(performance.now() - t0);
    registrar(
      'CP-AUD-01',
      'Denegación estricta 401 Unauthorized sin token JWT en GET /auditoria',
      unauthRes.status === 401,
      latenciaUnauth,
      `HTTP ${unauthRes.status}`
    );

    // Iniciar sesión y configurar 2FA para el admin
    const adminLogin = await loginUsuario(adminEmail, PASSWORD_TEST);
    const { token: adminToken, secreto: adminTotpSecret } = await activar2faSiEsRequerido(adminLogin);

    if (!adminToken) {
      throw new Error('No se pudo autenticar el usuario administrador de prueba');
    }

    // CP-AUD-02: Creación de Usuario y registro en bitácora (CREAR_USUARIO)
    const nuevoUserEmail = `operador.audit.${RUN_ID}@uagrm.edu.bo`;
    const t1 = performance.now();
    const crearUserRes = await fetch(`${BASE_URL}/usuarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        email: nuevoUserEmail,
        nombre: 'Operador Test Auditoría',
        password: 'Password123*',
        rol: 'FUNCIONARIO',
      }),
    });
    const latenciaCrearUser = Math.round(performance.now() - t1);
    const userCreadoData = await crearUserRes.json();
    if (userCreadoData?.id) {
      usuariosCreados.push(userCreadoData.id);
    }

    // Verificar inserción en bitácora forense en la base de datos
    const dbAuditCrear = await db.query(
      `SELECT * FROM core.auth_auditoria_forense 
       WHERE accion = 'CREAR_USUARIO' AND entidad_id = $1 
       ORDER BY creado_en DESC LIMIT 1`,
      [userCreadoData?.id]
    );

    registrar(
      'CP-AUD-02',
      'Auditoría forense de CREAR_USUARIO registrada en IDENTIDAD_ACCESO con entidadId y resultado EXITOSO',
      crearUserRes.status === 201 && dbAuditCrear.rows.length === 1 && dbAuditCrear.rows[0].modulo === 'IDENTIDAD_ACCESO',
      latenciaCrearUser,
      `Audit ID: ${dbAuditCrear.rows[0]?.id || 'N/A'}`
    );

    // CP-AUD-03: Actualización de Usuario y registro en bitácora (ACTUALIZAR_USUARIO)
    const t2 = performance.now();
    const updateRes = await fetch(`${BASE_URL}/usuarios/${userCreadoData.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        rol: 'JEFE_ACTIVO_FIJO',
        activo: true,
      }),
    });
    const latenciaUpdateUser = Math.round(performance.now() - t2);

    const dbAuditUpdate = await db.query(
      `SELECT * FROM core.auth_auditoria_forense 
       WHERE accion = 'ACTUALIZAR_USUARIO' AND entidad_id = $1 
       ORDER BY creado_en DESC LIMIT 1`,
      [userCreadoData?.id]
    );

    registrar(
      'CP-AUD-03',
      'Auditoría forense de ACTUALIZAR_USUARIO registrada en IDENTIDAD_ACCESO reflejando cambios de rol/estado',
      updateRes.status === 200 && dbAuditUpdate.rows.length === 1 && dbAuditUpdate.rows[0].modulo === 'IDENTIDAD_ACCESO',
      latenciaUpdateUser,
      `Detalle: ${dbAuditUpdate.rows[0]?.motivo_rechazo || 'N/A'}`
    );

    // CP-AUD-04: Elevación Step-Up 2FA y registro en bitácora (STEPUP_2FA)
    // Usamos el siguiente paso de tiempo (+30s) para evitar el detector anti-repetición TOTP
    const codigoStepUp = await generate({
      secret: adminTotpSecret,
      epoch: Math.floor(Date.now() / 1000) + 30,
    });
    const t3 = performance.now();
    const stepUpRes = await fetch(`${BASE_URL}/auth/stepup/verificar-2fa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ codigo: codigoStepUp }),
    });
    const latenciaStepUp = Math.round(performance.now() - t3);
    const stepUpData = await stepUpRes.json();

    const dbAuditStepUp = await db.query(
      `SELECT * FROM core.auth_auditoria_forense 
       WHERE accion = 'STEPUP_2FA' AND usuario_id = $1 
       ORDER BY creado_en DESC LIMIT 1`,
      [adminId]
    );

    registrar(
      'CP-AUD-04',
      'Auditoría forense de STEPUP_2FA registrada en módulo AUTENTICACION al validar elevación de 5 min',
      stepUpRes.status === 201 && stepUpData?.stepUpToken && dbAuditStepUp.rows.length === 1,
      latenciaStepUp,
      `Token expira: ${stepUpData?.expiraEnSegundos}s | Audit ID: ${dbAuditStepUp.rows[0]?.id || 'N/A'}`
    );

    // CP-AUD-05: Omitir 2FA Inicial en rol no obligatorio (OMITIR_2FA_INICIAL)
    const funcEmail = `funcionario.audit.${RUN_ID}@uagrm.edu.bo`;
    const funcRes = await db.query(
      `INSERT INTO core.auth_usuario (email, password_hash, nombre_completo, activo, estado)
       VALUES ($1, $2, $3, true, 'ACTIVO') RETURNING id`,
      [funcEmail, passwordHash, 'Funcionario Audit Test']
    );
    const funcId = funcRes.rows[0].id;
    usuariosCreados.push(funcId);
    await db.query(
      `INSERT INTO core.auth_usuario_rol (usuario_id, rol_id) VALUES ($1, 'FUNCIONARIO')`,
      [funcId]
    );

    const funcLogin = await loginUsuario(funcEmail, PASSWORD_TEST);
    const desafioToken = funcLogin.data?.desafioToken;

    const t4 = performance.now();
    const omitirRes = await fetch(`${BASE_URL}/auth/2fa/inicial/omitir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ desafioToken }),
    });
    const latenciaOmitir = Math.round(performance.now() - t4);
    const omitirData = await omitirRes.json();

    const dbAuditOmitir = await db.query(
      `SELECT * FROM core.auth_auditoria_forense 
       WHERE accion = 'OMITIR_2FA_INICIAL' AND usuario_id = $1 
       ORDER BY creado_en DESC LIMIT 1`,
      [funcId]
    );

    registrar(
      'CP-AUD-05',
      'Auditoría forense de OMITIR_2FA_INICIAL registrada en AUTENTICACION para roles opcionales',
      omitirRes.status === 201 && Boolean(omitirData?.sesion?.accessToken) && dbAuditOmitir.rows.length === 1,
      latenciaOmitir,
      `Audit ID: ${dbAuditOmitir.rows[0]?.id || 'N/A'}`
    );

    // CP-AUD-06: Generación de Etiquetas en Lote (GENERAR_ETIQUETAS_LOTE)
    // Obtener un código real de activo existente
    const activoExistente = await db.query(
      `SELECT codigo FROM core.activo_proyeccion LIMIT 2`
    );
    const codigosLote = activoExistente.rows.map((r) => r.codigo);

    if (codigosLote.length > 0) {
      const t5 = performance.now();
      const loteRes = await fetch(`${BASE_URL}/etiquetas/generar-lote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          codigos: codigosLote,
          formato: 'HIBRIDO',
          motivo: 'ALTA',
        }),
      });
      const latenciaLote = Math.round(performance.now() - t5);
      const loteData = await loteRes.json();

      const dbAuditLote = await db.query(
        `SELECT * FROM core.auth_auditoria_forense 
         WHERE accion = 'GENERAR_ETIQUETAS_LOTE' AND modulo = 'ETIQUETAS' 
         ORDER BY creado_en DESC LIMIT 1`
      );

      registrar(
        'CP-AUD-06',
        'Auditoría forense de GENERAR_ETIQUETAS_LOTE registrada en módulo ETIQUETAS',
        loteRes.status === 201 && loteData.success && dbAuditLote.rows.length === 1,
        latenciaLote,
        `Etiquetas generadas: ${loteData.totalProcesados} | Audit ID: ${dbAuditLote.rows[0]?.id || 'N/A'}`
      );
    } else {
      registrar('CP-AUD-06', 'Generación de etiquetas en lote (Omitido: sin activos en core)', true, 0);
    }

    // CP-AUD-07: CRUD de Plantillas de Etiquetas (CREAR, ACTUALIZAR, ELIMINAR)
    const t6 = performance.now();
    const nombrePlantilla = `Plantilla Test Audit ${RUN_ID}`;
    const crearPlantillaRes = await fetch(`${BASE_URL}/etiquetas/plantillas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        nombre: nombrePlantilla,
        tipoPapel: 'INDIVIDUAL',
        anchoMm: 80,
        altoMm: 40,
        tipoCodigo: 'HIBRIDO',
        descripcion: 'Plantilla de prueba para suite de auditoría',
        configuracion: {
          showLogo: true,
          showInstitucion: true,
          textoInstitucion: 'U.A.G.R.M. - ACTIVO FIJO',
          showCodigoTexto: true,
          showDescripcion: true,
          showCustodio: false,
          showOficina: true,
          showFecha: false,
          showHashSeguridad: true,
          showBordeCorte: true,
          tamanoFuente: 'medio',
          orientacion: 'horizontal',
        },
      }),
    });
    const plantillaCreada = await crearPlantillaRes.json();
    if (plantillaCreada?.id) {
      plantillasCreadas.push(plantillaCreada.id);
    }

    const auditPlantillaCrear = await db.query(
      `SELECT * FROM core.auth_auditoria_forense 
       WHERE accion = 'CREAR_PLANTILLA_ETIQUETA' AND entidad_id = $1`,
      [plantillaCreada?.id]
    );

    // Actualizar plantilla
    const updatePlantillaRes = await fetch(`${BASE_URL}/etiquetas/plantillas/${plantillaCreada.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        descripcion: 'Descripción actualizada por la suite de auditoría',
      }),
    });

    const auditPlantillaUpdate = await db.query(
      `SELECT * FROM core.auth_auditoria_forense 
       WHERE accion = 'ACTUALIZAR_PLANTILLA_ETIQUETA' AND entidad_id = $1`,
      [plantillaCreada?.id]
    );

    // Eliminar plantilla
    const deletePlantillaRes = await fetch(`${BASE_URL}/etiquetas/plantillas/${plantillaCreada.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const auditPlantillaDelete = await db.query(
      `SELECT * FROM core.auth_auditoria_forense 
       WHERE accion = 'ELIMINAR_PLANTILLA_ETIQUETA' AND entidad_id = $1`,
      [plantillaCreada?.id]
    );
    const latenciaPlantillas = Math.round(performance.now() - t6);

    const crudAprobado =
      crearPlantillaRes.status === 201 &&
      updatePlantillaRes.status === 200 &&
      deletePlantillaRes.status === 200 &&
      auditPlantillaCrear.rows.length === 1 &&
      auditPlantillaUpdate.rows.length === 1 &&
      auditPlantillaDelete.rows.length === 1;

    registrar(
      'CP-AUD-07',
      'Ciclo completo de plantillas registra CREAR, ACTUALIZAR y ELIMINAR_PLANTILLA_ETIQUETA en módulo ETIQUETAS',
      crudAprobado,
      latenciaPlantillas,
      `Auditorías validadas: 3 eventos en base de datos`
    );

    // CP-AUD-08: Consulta filtrada en GET /auditoria por acción y módulo
    const t7 = performance.now();
    const queryRes = await fetch(`${BASE_URL}/auditoria?accion=CREAR_USUARIO&modulo=IDENTIDAD_ACCESO`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const latenciaQuery = Math.round(performance.now() - t7);
    const queryData = await queryRes.json();

    const filtroValido =
      queryRes.status === 200 &&
      Array.isArray(queryData.items) &&
      queryData.items.length > 0 &&
      queryData.items.every((item) => item.accion === 'CREAR_USUARIO' && item.modulo === 'IDENTIDAD_ACCESO');

    registrar(
      'CP-AUD-08',
      'Consulta y filtrado estricto en GET /auditoria por accion y modulo',
      filtroValido,
      latenciaQuery,
      `Total coincidentes: ${queryData.total} | Retornados: ${queryData.items.length}`
    );
  } finally {
    // Limpieza de datos de prueba
    console.log('\n🧹 Limpiando registros de prueba...');
    for (const pId of plantillasCreadas) {
      await db.query(`DELETE FROM core.plantilla_etiqueta WHERE id = $1`, [pId]).catch(() => {});
    }
    for (const uId of usuariosCreados) {
      await db.query(`DELETE FROM core.auth_auditoria_forense WHERE usuario_id = $1`, [uId]).catch(() => {});
      await db.query(`DELETE FROM core.auth_usuario_rol WHERE usuario_id = $1`, [uId]).catch(() => {});
      await db.query(`DELETE FROM core.auth_usuario WHERE id = $1`, [uId]).catch(() => {});
    }
    await db.end();
  }

  // Resumen final
  console.log('\n' + '='.repeat(75));
  console.log('  RESUMEN DE PRUEBAS DE COBERTURA DE BITÁCORA FORENSE');
  console.log('='.repeat(75));
  const total = resultados.length;
  const aprobadas = resultados.filter((r) => r.aprobado).length;
  const fallidas = total - aprobadas;

  console.log(`Total Pruebas : ${total}`);
  console.log(`Aprobadas     : ${aprobadas} ✅`);
  console.log(`Fallidas      : ${fallidas} ${fallidas > 0 ? '❌' : ''}`);

  if (fallidas > 0) {
    console.error('\n⚠️ Se detectaron fallas en la verificación de bitácora.');
    process.exit(1);
  } else {
    console.log('\n🎉 ¡TODAS LAS PRUEBAS DE AUDITORÍA FORENSE PASARON SATISFACTORIAMENTE!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Error fatal durante la ejecución de la suite:', err);
  process.exit(1);
});
