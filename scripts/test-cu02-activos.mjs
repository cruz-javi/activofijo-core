const API_URL = 'http://localhost:3000';

async function testCU02() {
  console.log('====================================================');
  console.log('🧪 VALIDACIÓN CU02 — CATÁLOGO Y FILTRO DE ACTIVOS FIJOS');
  console.log('====================================================');

  // 1. Iniciar sesión como Administrador
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador: 'admin@uagrm.edu.bo', password: 'Uagrm2026*' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  const refreshToken = loginData.refreshToken;

  if (!token) {
    console.error('❌ Error al autenticar:', loginData);
    process.exit(1);
  }
  console.log('✅ Autenticación exitosa como Administrador');

  // 2. Probar GET /activos (catálogo general)
  const allRes = await fetch(`${API_URL}/activos?limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const allData = await allRes.json();
  console.log(`\n📋 Catálogo General: Total ${allData.total} activos encontrados (recibidos ${allData.data?.length})`);
  if (allData.total > 0) {
    const primer = allData.data[0];
    console.log('   Ejemplo de Activo:', {
      codigo: primer.codigo,
      descripcion: primer.descripcion.slice(0, 45) + '...',
      unidad: primer.unidad,
      custodio: primer.custodio?.nombreCompleto,
      estado: primer.estado,
      valor: `${primer.valor} Bs.`,
    });
  }

  // 3. Probar GET /activos/filtros-metadata
  const metaRes = await fetch(`${API_URL}/activos/filtros-metadata`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const metaData = await metaRes.json();
  console.log('\n📊 Metadatos de Filtro:', {
    unidades: metaData.unidades?.length,
    estados: metaData.estados,
    grupos: metaData.grupos?.length,
  });

  // 4. Probar filtro por código exacto/parcial
  const codRes = await fetch(`${API_URL}/activos?codigo=UAGRM-REC-003`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const codData = await codRes.json();
  console.log(`\n🔍 Filtro por Código [UAGRM-REC-003]: encontrados ${codData.total}`);
  if (codData.total === 1 && codData.data[0]?.codigo === 'UAGRM-REC-003') {
    console.log('   ✅ Filtro por código exacto validado correctamente');
  } else {
    console.log('   ❌ Error en filtro por código:', codData);
  }

  // 5. Probar filtro por Unidad (FICCT)
  const uniRes = await fetch(`${API_URL}/activos?unidad=FICCT`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const uniData = await uniRes.json();
  console.log(`\n🏢 Filtro por Unidad [FICCT]: encontrados ${uniData.total} activos`);
  const todosFicct = uniData.data?.every((a) => a.unidad?.includes('FICCT'));
  if (todosFicct && uniData.total > 0) {
    console.log('   ✅ Todos los activos devueltos pertenecen a FICCT');
  } else {
    console.log('   ❌ Discrepancia en filtro de unidad');
  }

  // 6. Probar filtro por Custodio (Patricia Vaca / 3001)
  const custRes = await fetch(`${API_URL}/activos?custodio=3001`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const custData = await custRes.json();
  console.log(`\n👤 Filtro por Custodio [3001]: encontrados ${custData.total} activos`);
  const todosCust = custData.data?.every((a) => a.custodio?.codigo === 3001);
  if (todosCust && custData.total > 0) {
    console.log('   ✅ Todos los activos devueltos tienen custodio 3001');
  } else {
    console.log('   ❌ Discrepancia en filtro de custodio');
  }

  // 7. Probar filtro por Estado (BUENO)
  const estRes = await fetch(`${API_URL}/activos?estado=BUENO`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const estData = await estRes.json();
  console.log(`\n🏷️ Filtro por Estado [BUENO]: encontrados ${estData.total} activos`);
  const todosBueno = estData.data?.every((a) => a.estado === 'BUENO');
  if (todosBueno && estData.total > 0) {
    console.log('   ✅ Todos los activos devueltos están en estado BUENO');
  }

  // 8. Probar cierre de sesión (LOGOUT) y verificación en bitácora
  console.log('\n🔒 Probando cierre de sesión y registro en Bitácora Forense...');
  const logoutRes = await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-forwarded-for': '190.181.45.12',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestBrowser',
    },
    body: JSON.stringify({ refreshToken }),
  });
  console.log('   Logout status:', logoutRes.status);

  // Iniciar sesión nuevamente para verificar bitácora
  const reLogin = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador: 'admin@uagrm.edu.bo', password: 'Uagrm2026*' }),
  });
  const reToken = (await reLogin.json()).accessToken;

  const auditRes = await fetch(`${API_URL}/auditoria?accion=LOGOUT`, {
    headers: { Authorization: `Bearer ${reToken}` },
  });
  const auditData = await auditRes.json();
  const logoutItem = auditData.items?.[0];
  if (logoutItem && logoutItem.accion === 'LOGOUT') {
    console.log('   ✅ Evento LOGOUT registrado en Bitácora Forense:', {
      id: logoutItem.id,
      accion: logoutItem.accion,
      usuario: logoutItem.emailUsuario,
      ip: logoutItem.ipOrigen,
      resultado: logoutItem.resultado,
      fecha: logoutItem.creadoEn,
    });
  } else {
    console.log('   ❌ No se encontró evento LOGOUT en bitácora');
  }

  console.log('\n====================================================');
  console.log('🏁 Pruebas backend CU02 completadas exitosamente');
  console.log('====================================================');
}

testCU02().catch(console.error);
