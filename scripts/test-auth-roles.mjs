// Script de validación por consola de Autenticación, Roles y Permisos UAGRM
const API_URL = 'http://localhost:3000';

async function testLogin(identificador, password, expectedRole) {
  process.stdout.write(`\n🔍 Probando autenticación para: ${identificador}... `);
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador, password })
    });

    const data = await res.json();
    if (!res.ok) {
      console.log(`❌ ERROR ${res.status}:`, data.message || data);
      return null;
    }

    const roles = data.user?.roles || [];
    const rol = data.user?.rol || roles[0];
    const hasRole = expectedRole ? roles.includes(expectedRole) : true;

    if (hasRole) {
      console.log(`✅ OK (${res.status})`);
      console.log(`   Nombre: ${data.user?.nombre}`);
      console.log(`   Rol Principal: ${rol} (Roles: [${roles.join(', ')}])`);
      console.log(`   Permisos asignados: ${data.user?.permisos?.length || 0} permisos`);
      return { token: data.accessToken, user: data.user };
    } else {
      console.log(`❌ Rol inesperado: obtenido [${roles.join(', ')}], esperado ${expectedRole}`);
      return null;
    }
  } catch (err) {
    console.log(`❌ Error de conexión: ${err.message}`);
    return null;
  }
}

async function testAccess(token, endpoint, description, expectedSuccess = true) {
  process.stdout.write(`🔒 Probando acceso a ${endpoint} (${description})... `);
  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok && expectedSuccess) {
      console.log(`✅ Acceso permitido (${res.status})`);
      return true;
    } else if (res.status === 403 && !expectedSuccess) {
      console.log(`✅ Acceso denegado correctamente con 403 Forbidden`);
      return true;
    } else {
      const body = await res.json().catch(() => ({}));
      console.log(`❌ Resultado no esperado (${res.status}):`, body.message || body);
      return false;
    }
  } catch (err) {
    console.log(`❌ Error de conexión: ${err.message}`);
    return false;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 VALIDACIÓN DE AUTENTICACIÓN, ROLES Y PERMISOS CU01');
  console.log('====================================================');

  // 1. Probar Administrador por correo institucional
  const adminByEmail = await testLogin('admin@uagrm.edu.bo', 'Uagrm2026*', 'ADMINISTRADOR');

  // 2. Probar Administrador por código de empleado
  const adminByCode = await testLogin('1001', 'Uagrm2026*', 'ADMINISTRADOR');

  // 3. Probar Jefe de Activo Fijo por correo y código
  const jefeByEmail = await testLogin('jefe@uagrm.edu.bo', 'Uagrm2026*', 'JEFE_ACTIVO_FIJO');
  const jefeByCode = await testLogin('2001', 'Uagrm2026*', 'JEFE_ACTIVO_FIJO');

  // 4. Probar Funcionario por correo y código
  const funcByEmail = await testLogin('funcionario@uagrm.edu.bo', 'Uagrm2026*', 'FUNCIONARIO');
  const funcByCode = await testLogin('3001', 'Uagrm2026*', 'FUNCIONARIO');

  console.log('\n--- Pruebas de Autorización y Permisos Granulares ---');

  if (adminByEmail?.token) {
    await testAccess(adminByEmail.token, '/usuarios', 'Administrador accediendo a Gestión de Usuarios', true);
    await testAccess(adminByEmail.token, '/sincronizacion/historial', 'Administrador accediendo a Sincronización', true);
    await testAccess(adminByEmail.token, '/auditoria', 'Administrador accediendo a Bitácora Forense', true);
    await testAccess(adminByEmail.token, '/roles', 'Administrador consultando Roles Dinámicos', true);
    await testAccess(adminByEmail.token, '/permisos', 'Administrador consultando Catálogo de Permisos', true);
  }

  if (funcByEmail?.token) {
    await testAccess(funcByEmail.token, '/usuarios', 'Funcionario intentando acceder a Gestión de Usuarios', false);
    await testAccess(funcByEmail.token, '/auditoria', 'Funcionario intentando acceder a Bitácora Forense', false);
    await testAccess(funcByEmail.token, '/roles', 'Funcionario intentando acceder a Configuración de Roles', false);
    await testAccess(funcByEmail.token, '/activos', 'Funcionario consultando Catálogo de Activos', true);
  }

  if (jefeByEmail?.token) {
    await testAccess(jefeByEmail.token, '/activos', 'Jefe de Activo Fijo consultando Catálogo de Activos', true);
    await testAccess(jefeByEmail.token, '/usuarios', 'Jefe de Activo Fijo accediendo a Gestión de Usuarios', false);
  }

  console.log('\n--- Pruebas de Bloqueo por Seguridad y Desbloqueo por Administrador ---');
  // Crear un usuario de prueba para simular los 5 intentos fallidos
  const tempEmail = `test.seguridad.${Date.now()}@uagrm.edu.bo`;
  const createRes = await fetch(`${API_URL}/usuarios`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminByEmail.token}`
    },
    body: JSON.stringify({
      email: tempEmail,
      nombre: 'Usuario Prueba Seguridad',
      password: 'Password123*',
      rol: 'FUNCIONARIO',
      cargoInstitucional: 'Auxiliar de Prueba'
    })
  });
  const tempUser = await createRes.json();
  console.log(`👤 Usuario de prueba creado: ${tempEmail} (ID: ${tempUser.id})`);

  // Simular 5 intentos fallidos consecutivos con contraseñas erróneas
  console.log('⚡ Ejecutando 5 intentos fallidos con contraseña errónea...');
  for (let i = 1; i <= 5; i++) {
    const failRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: tempEmail, password: 'WrongPassword999*' })
    });
    const failData = await failRes.json();
    console.log(`   Intento ${i}: Status ${failRes.status} -> ${failData.message}`);
  }

  // Verificar que el 6to intento (incluso con la contraseña correcta) sea denegado por bloqueo definitivo
  console.log('🔒 Verificando bloqueo definitivo con contraseña correcta...');
  const blockedRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador: tempEmail, password: 'Password123*' })
  });
  const blockedData = await blockedRes.json();
  if (blockedRes.status === 401 && blockedData.message?.includes('bloqueado')) {
    console.log(`✅ Bloqueo definitivo confirmado: "${blockedData.message}"`);
  } else {
    console.log(`❌ Falla en bloqueo:`, blockedData);
  }

  // Ahora el Administrador desbloquea al usuario presencialmente vía PATCH /usuarios/:id
  console.log('🔓 Administrador reactiva la cuenta presencialmente...');
  const unlockRes = await fetch(`${API_URL}/usuarios/${tempUser.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminByEmail.token}`
    },
    body: JSON.stringify({ estado: 'ACTIVO' })
  });
  const unlockData = await unlockRes.json();
  console.log(`   Estado reactivado: ${unlockData.estado}, Intentos fallidos: ${unlockData.intentosFallidos}`);

  // Verificar que ahora sí pueda autenticarse exitosamente
  console.log('🔑 Probando autenticación tras reactivación administrativa...');
  const reactivatedRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador: tempEmail, password: 'Password123*' })
  });
  const reactivatedData = await reactivatedRes.json();
  if (reactivatedRes.ok) {
    console.log(`✅ Usuario reactivado inició sesión exitosamente! Token generado: ${reactivatedData.accessToken ? 'OK' : 'FAIL'}`);
  } else {
    console.log(`❌ Error tras desbloqueo:`, reactivatedData);
  }

  console.log('\n====================================================');
  console.log('🏁 Pruebas de consola concluidas exitosamente');
  console.log('====================================================');
}

runTests();
