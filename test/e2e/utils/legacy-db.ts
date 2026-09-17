import pg from 'pg';

// Cliente directo con el rol `migrator` (privilegios completos sobre
// core y legacy_demo) para preparar fixtures y simular fallas de origen
// que el rol de aplicación `legacy_ro` no podría provocar por sí mismo.
function migratorClient(): pg.Client {
  const connectionString = process.env.DIRECT_DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_DATABASE_URL no está configurado; requerido para los fixtures de e2e');
  }
  return new pg.Client({ connectionString });
}

export async function insertLegacyBien(bien: {
  codigoAntiguo: string;
  descripcionBien: string;
  categoria: string;
  ubicacionEdificio: string;
  ubicacionAula: string;
  responsableNombre: string;
  valorCompra: number;
  estadoConservacion?: string;
}): Promise<void> {
  const client = migratorClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO legacy_demo.bienes_patrimoniales
        (codigo_antiguo, descripcion_bien, categoria, ubicacion_edificio, ubicacion_aula, responsable_nombre, valor_compra, estado_conservacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        bien.codigoAntiguo,
        bien.descripcionBien,
        bien.categoria,
        bien.ubicacionEdificio,
        bien.ubicacionAula,
        bien.responsableNombre,
        bien.valorCompra,
        bien.estadoConservacion || 'BUENO',
      ],
    );
  } finally {
    await client.end();
  }
}

