CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS legacy_demo;

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'migrator') THEN
        CREATE ROLE migrator WITH LOGIN PASSWORD 'migrator_secret';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_rw') THEN
        CREATE ROLE app_rw WITH LOGIN PASSWORD 'app_rw_secret';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'legacy_ro') THEN
        CREATE ROLE legacy_ro WITH LOGIN PASSWORD 'legacy_ro_secret';
    END IF;
END $$;

DO $$
BEGIN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO migrator, app_rw, legacy_ro', current_database());
END $$;

GRANT USAGE, CREATE ON SCHEMA core TO migrator;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA core TO migrator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA core TO migrator;
ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT ALL ON TABLES TO migrator;
ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT ALL ON SEQUENCES TO migrator;

GRANT USAGE ON SCHEMA core TO app_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core TO app_rw;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA core TO app_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT USAGE, SELECT ON SEQUENCES TO app_rw;

REVOKE ALL PRIVILEGES ON SCHEMA core FROM legacy_ro;

GRANT USAGE ON SCHEMA legacy_demo TO legacy_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA legacy_demo TO legacy_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA legacy_demo GRANT SELECT ON TABLES TO legacy_ro;

GRANT USAGE, CREATE ON SCHEMA legacy_demo TO migrator;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA legacy_demo TO migrator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA legacy_demo TO migrator;

CREATE TABLE IF NOT EXISTS legacy_demo.responsables_patrimonio (
    id_responsable SERIAL PRIMARY KEY,
    ci VARCHAR(20) NOT NULL UNIQUE,
    nombre_completo VARCHAR(150) NOT NULL,
    departamento VARCHAR(100) NOT NULL,
    cargo VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS legacy_demo.bienes_patrimoniales (
    id_bien SERIAL PRIMARY KEY,
    codigo_antiguo VARCHAR(50) NOT NULL UNIQUE,
    descripcion_bien TEXT NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    ubicacion_edificio VARCHAR(100) NOT NULL,
    ubicacion_aula VARCHAR(50) NOT NULL,
    responsable_id INT REFERENCES legacy_demo.responsables_patrimonio(id_responsable),
    responsable_nombre VARCHAR(150) NOT NULL,
    valor_compra NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    estado_conservacion VARCHAR(30) NOT NULL DEFAULT 'BUENO',
    fecha_incorporacion DATE NOT NULL DEFAULT CURRENT_DATE
);

GRANT SELECT ON ALL TABLES IN SCHEMA legacy_demo TO legacy_ro;

INSERT INTO legacy_demo.responsables_patrimonio (id_responsable, ci, nombre_completo, departamento, cargo)
VALUES 
    (1, '4892019-SC', 'Ing. Carlos René Melgar', 'FICCT - Redes y Telecomunicaciones', 'Jefe de Laboratorio'),
    (2, '5321098-SC', 'Lic. Patricia Vaca Suárez', 'Biblioteca Central UAGRM', 'Administradora de Hemeroteca'),
    (3, '3987112-SC', 'Dr. Roberto Suárez Montero', 'Facultad de Ciencias Exactas y Tecnología', 'Docente Investigador')
ON CONFLICT (id_responsable) DO NOTHING;

INSERT INTO legacy_demo.bienes_patrimoniales (
    id_bien, codigo_antiguo, descripcion_bien, categoria,
    ubicacion_edificio, ubicacion_aula, responsable_id, responsable_nombre,
    valor_compra, estado_conservacion, fecha_incorporacion
)
VALUES
    (1, 'UAGRM-LEG-00101', 'Servidor de Red Dell PowerEdge R740 64GB RAM', 'Equipos de Computación', 'Módulo 236 - FICCT', 'Data Center Piso 2', 1, 'Ing. Carlos René Melgar', 28500.00, 'BUENO', '2021-03-15'),
    (2, 'UAGRM-LEG-00102', 'Proyector Láser Epson PowerLite EB-L520U 5200 Lúmenes', 'Equipos Audiovisuales', 'Módulo 236 - FICCT', 'Laboratorio 3 (Redes)', 1, 'Ing. Carlos René Melgar', 8200.00, 'REGULAR', '2022-07-20'),
    (3, 'UAGRM-LEG-00201', 'Microscopio Binocular de Alta Precisión Olympus CX23', 'Instrumental Científico', 'Módulo 214 - Ciencias Exactas', 'Laboratorio Central de Química', 3, 'Dr. Roberto Suárez Montero', 14300.00, 'EXCELENTE', '2020-11-10'),
    (4, 'UAGRM-LEG-00301', 'Terminal de Consulta Automática Touchscreen HP ProDesk 400', 'Equipos de Computación', 'Edificio Central', 'Sala de Lectura Principal', 2, 'Lic. Patricia Vaca Suárez', 5600.00, 'BUENO', '2023-02-01'),
    (5, 'UAGRM-LEG-00302', 'Lote de Estantería Metálica de Doble Cara 5 Niveles', 'Muebles y Enseres', 'Edificio Central', 'Depósito General de Archivo', 2, 'Lic. Patricia Vaca Suárez', 3200.00, 'REGULAR', '2019-05-18')
ON CONFLICT (id_bien) DO NOTHING;

SELECT setval('legacy_demo.responsables_patrimonio_id_responsable_seq', COALESCE((SELECT MAX(id_responsable) FROM legacy_demo.responsables_patrimonio), 1));
SELECT setval('legacy_demo.bienes_patrimoniales_id_bien_seq', COALESCE((SELECT MAX(id_bien) FROM legacy_demo.bienes_patrimoniales), 1));
