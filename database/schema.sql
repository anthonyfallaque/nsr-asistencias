-- ============================================================
-- Sistema de Asistencias - Nuestra Señora del Rosario
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- Roles del sistema
-- ────────────────────────────────────────────────────────────
CREATE TABLE roles (
  id   SERIAL PRIMARY KEY,
  nombre VARCHAR(30) NOT NULL UNIQUE
  -- portero, auxiliar, tutora, directora, admin
);

INSERT INTO roles (nombre) VALUES
  ('admin'),
  ('portero'),
  ('auxiliar'),
  ('tutora'),
  ('directora');

-- ────────────────────────────────────────────────────────────
-- Usuarios del sistema
-- ────────────────────────────────────────────────────────────
CREATE TABLE usuarios (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  nombre        VARCHAR(100) NOT NULL,
  rol_id        INT         NOT NULL REFERENCES roles(id),
  activo        BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- Grados (3°, 4°, 5° de secundaria)
-- ────────────────────────────────────────────────────────────
CREATE TABLE grados (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(10) NOT NULL UNIQUE  -- '3°', '4°', '5°'
);

INSERT INTO grados (nombre) VALUES ('3°'), ('4°'), ('5°');

-- ────────────────────────────────────────────────────────────
-- Secciones
-- ────────────────────────────────────────────────────────────
CREATE TABLE secciones (
  id        SERIAL PRIMARY KEY,
  grado_id  INT         NOT NULL REFERENCES grados(id),
  nombre    VARCHAR(5)  NOT NULL,  -- 'A', 'B', ... 'I'
  tutora_id UUID        REFERENCES usuarios(id) ON DELETE SET NULL,
  UNIQUE(grado_id, nombre)
);

-- 9 secciones por grado
DO $$
DECLARE g INT; s TEXT;
BEGIN
  FOREACH g IN ARRAY ARRAY[1,2,3] LOOP
    FOREACH s IN ARRAY ARRAY['A','B','C','D','E','F','G','H','I'] LOOP
      INSERT INTO secciones (grado_id, nombre) VALUES (g, s);
    END LOOP;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- Alumnas
-- ────────────────────────────────────────────────────────────
CREATE TABLE alumnas (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombres     VARCHAR(100) NOT NULL,
  apellidos   VARCHAR(100) NOT NULL,
  dni         VARCHAR(8)   UNIQUE,
  seccion_id  INT          NOT NULL REFERENCES secciones(id),
  qr_token    VARCHAR(64)  NOT NULL UNIQUE,  -- token aleatorio, NO datos personales
  foto_url    VARCHAR(500),
  activa      BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alumnas_seccion  ON alumnas(seccion_id);
CREATE INDEX idx_alumnas_qr_token ON alumnas(qr_token);

-- ────────────────────────────────────────────────────────────
-- Configuración de horario de entrada
-- ────────────────────────────────────────────────────────────
CREATE TABLE configuracion_horario (
  id                   SERIAL  PRIMARY KEY,
  hora_entrada         TIME    NOT NULL DEFAULT '07:30:00',
  minutos_tolerancia   INT     NOT NULL DEFAULT 15,
  activo               BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO configuracion_horario (hora_entrada, minutos_tolerancia)
VALUES ('07:30:00', 15);

-- ────────────────────────────────────────────────────────────
-- Registros de asistencia
-- ────────────────────────────────────────────────────────────
CREATE TYPE estado_asistencia AS ENUM ('puntual', 'tardanza', 'ausente', 'justificada');

CREATE TABLE asistencias (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  alumna_id       UUID              NOT NULL REFERENCES alumnas(id),
  fecha           DATE              NOT NULL DEFAULT CURRENT_DATE,
  hora_escaneo    TIMESTAMPTZ,
  estado          estado_asistencia NOT NULL DEFAULT 'ausente',
  justificacion   TEXT,
  registrado_por  UUID              REFERENCES usuarios(id),
  ip_origen       VARCHAR(45),
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  UNIQUE(alumna_id, fecha)  -- idempotencia: 1 registro por alumna por día
);

CREATE INDEX idx_asistencias_fecha       ON asistencias(fecha);
CREATE INDEX idx_asistencias_alumna_fecha ON asistencias(alumna_id, fecha);

-- ────────────────────────────────────────────────────────────
-- Cola offline: escaneos que llegaron sin conexión
-- (procesados por el servidor al sincronizar)
-- ────────────────────────────────────────────────────────────
CREATE TABLE cola_offline (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_token    VARCHAR(64) NOT NULL,
  scanned_at  TIMESTAMPTZ NOT NULL,
  processed   BOOLEAN     NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  registrado_por UUID     REFERENCES usuarios(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- Auditoría de accesos
-- ────────────────────────────────────────────────────────────
CREATE TABLE auditoria (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID        REFERENCES usuarios(id),
  accion      VARCHAR(100) NOT NULL,
  detalle     JSONB,
  ip          VARCHAR(45),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX idx_auditoria_created ON auditoria(created_at);

-- ────────────────────────────────────────────────────────────
-- Función: actualiza updated_at automáticamente
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_usuarios
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_alumnas
  BEFORE UPDATE ON alumnas
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_asistencias
  BEFORE UPDATE ON asistencias
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ────────────────────────────────────────────────────────────
-- Vista: asistencia del día con datos completos
-- ────────────────────────────────────────────────────────────
CREATE VIEW v_asistencias_hoy AS
SELECT
  a.id,
  al.id          AS alumna_id,
  al.nombres,
  al.apellidos,
  al.foto_url,
  al.dni,
  g.nombre       AS grado,
  s.nombre       AS seccion,
  a.fecha,
  a.hora_escaneo,
  a.estado,
  a.justificacion
FROM alumnas al
JOIN secciones s ON s.id = al.seccion_id
JOIN grados g    ON g.id = s.grado_id
LEFT JOIN asistencias a ON a.alumna_id = al.id AND a.fecha = CURRENT_DATE
WHERE al.activa = true;

-- ────────────────────────────────────────────────────────────
-- Vista: resumen por sección del día
-- ────────────────────────────────────────────────────────────
CREATE VIEW v_resumen_seccion_hoy AS
SELECT
  g.nombre        AS grado,
  s.nombre        AS seccion,
  s.id            AS seccion_id,
  COUNT(al.id)    AS total,
  COUNT(a.id) FILTER (WHERE a.estado = 'puntual')     AS puntuales,
  COUNT(a.id) FILTER (WHERE a.estado = 'tardanza')    AS tardanzas,
  COUNT(a.id) FILTER (WHERE a.estado = 'justificada') AS justificadas,
  COUNT(al.id) - COUNT(a.id) FILTER (WHERE a.estado != 'ausente') AS ausentes
FROM secciones s
JOIN grados g ON g.id = s.grado_id
JOIN alumnas al ON al.seccion_id = s.id AND al.activa = true
LEFT JOIN asistencias a ON a.alumna_id = al.id AND a.fecha = CURRENT_DATE
GROUP BY g.id, g.nombre, s.id, s.nombre
ORDER BY g.id, s.nombre;
