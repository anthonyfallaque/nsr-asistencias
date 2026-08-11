-- ============================================================
-- Migración 001 — Refactor de seguridad, zona horaria e integridad
-- Sistema de Asistencias · Nuestra Señora del Rosario (Chiclayo)
--
-- Idempotente: se puede ejecutar varias veces sin efectos adversos.
--   psql "$DATABASE_URL" -f database/migrations/001_refactor_seguridad.sql
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. Usuarios: obligar cambio de contraseña inicial
-- ────────────────────────────────────────────────────────────
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT false;

-- ────────────────────────────────────────────────────────────
-- 2. Autorización por ámbito: la tutora sólo ve sus secciones
--    (el middleware scopeSecciones consulta secciones.tutora_id
--     en cada petición autenticada)
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_secciones_tutora ON secciones(tutora_id);

-- ────────────────────────────────────────────────────────────
-- 3. Asistencias: origen del registro
--    El cliente ya no controla la hora; el origen deja constancia
--    de por qué vía entró cada fila.
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  CREATE TYPE origen_asistencia AS ENUM ('escaneo', 'offline', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- El backfill sólo debe correr la primera vez: en una segunda ejecución
-- reetiquetaría como 'escaneo' filas marcadas a mano legítimamente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'asistencias' AND column_name = 'origen'
  ) THEN
    ALTER TABLE asistencias
      ADD COLUMN origen origen_asistencia NOT NULL DEFAULT 'manual';

    -- Las filas antiguas con hora de escaneo vinieron del lector
    UPDATE asistencias SET origen = 'escaneo' WHERE hora_escaneo IS NOT NULL;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 4. Integridad histórica: la sección queda congelada en la
--    propia asistencia. Promover alumnas ya no reescribe el pasado.
-- ────────────────────────────────────────────────────────────
-- La fecha por defecto era CURRENT_DATE (TZ del servidor, UTC en Render):
-- desde las 19:00 de Lima ya adelantaba un día.
ALTER TABLE asistencias
  ALTER COLUMN fecha SET DEFAULT (NOW() AT TIME ZONE 'America/Lima')::date;

ALTER TABLE asistencias
  ADD COLUMN IF NOT EXISTS seccion_id INT REFERENCES secciones(id);

-- Backfill: mejor aproximación disponible (sección actual de la alumna)
UPDATE asistencias a
   SET seccion_id = al.seccion_id
  FROM alumnas al
 WHERE al.id = a.alumna_id
   AND a.seccion_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_asistencias_seccion_fecha
  ON asistencias(seccion_id, fecha);

-- ────────────────────────────────────────────────────────────
-- 5. Cola offline: idempotencia real
--    Sin restricción única el ON CONFLICT DO NOTHING no hacía nada
--    y cada reintento duplicaba la cola.
-- ────────────────────────────────────────────────────────────
DELETE FROM cola_offline c
 USING cola_offline d
 WHERE c.qr_token = d.qr_token
   AND c.scanned_at = d.scanned_at
   AND c.ctid > d.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS ux_cola_offline_token_scan
  ON cola_offline (qr_token, scanned_at);

CREATE INDEX IF NOT EXISTS idx_cola_offline_pendientes
  ON cola_offline (created_at) WHERE processed = false;

-- ────────────────────────────────────────────────────────────
-- 6. Configuración de horario: exactamente una fila activa
-- ────────────────────────────────────────────────────────────
UPDATE configuracion_horario
   SET activo = false
 WHERE activo = true
   AND id <> (SELECT MIN(id) FROM configuracion_horario WHERE activo = true);

CREATE UNIQUE INDEX IF NOT EXISTS ux_config_horario_activo
  ON configuracion_horario (activo) WHERE activo;

-- ────────────────────────────────────────────────────────────
-- 7. Índices redundantes (ya cubiertos por restricciones UNIQUE)
-- ────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_alumnas_qr_token;         -- cubierto por alumnas.qr_token UNIQUE
DROP INDEX IF EXISTS idx_asistencias_alumna_fecha; -- cubierto por UNIQUE(alumna_id, fecha)

-- Búsqueda por apellidos/nombres del listado de alumnas
CREATE INDEX IF NOT EXISTS idx_alumnas_orden ON alumnas (apellidos, nombres);

-- ────────────────────────────────────────────────────────────
-- 8. Vistas: fecha en America/Lima y sección histórica
--    · CURRENT_DATE dependía de la TZ del servidor (UTC en Render):
--      a partir de las 19:00 de Lima ya "era mañana".
--    · v_resumen_seccion_hoy usaba INNER JOIN: las secciones sin
--      alumnas activas desaparecían del dashboard.
--    · La ausencia se deriva: sin fila ⇒ ausente.
-- ────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_asistencias_hoy;
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
  s.id           AS seccion_id,
  (NOW() AT TIME ZONE 'America/Lima')::date        AS fecha,
  a.hora_escaneo,
  COALESCE(a.estado, 'ausente'::estado_asistencia) AS estado,
  a.justificacion
FROM alumnas al
LEFT JOIN asistencias a
       ON a.alumna_id = al.id
      AND a.fecha = (NOW() AT TIME ZONE 'America/Lima')::date
JOIN secciones s ON s.id = COALESCE(a.seccion_id, al.seccion_id)
JOIN grados g    ON g.id = s.grado_id
WHERE al.activa = true;

DROP VIEW IF EXISTS v_resumen_seccion_hoy;
CREATE VIEW v_resumen_seccion_hoy AS
SELECT
  g.nombre     AS grado,
  s.nombre     AS seccion,
  s.id         AS seccion_id,
  COUNT(al.id) AS total,
  COUNT(a.id) FILTER (WHERE a.estado = 'puntual')     AS puntuales,
  COUNT(a.id) FILTER (WHERE a.estado = 'tardanza')    AS tardanzas,
  COUNT(a.id) FILTER (WHERE a.estado = 'justificada') AS justificadas,
  COUNT(al.id) FILTER (
    WHERE COALESCE(a.estado, 'ausente'::estado_asistencia) = 'ausente'
  ) AS ausentes
FROM secciones s
JOIN grados g ON g.id = s.grado_id
LEFT JOIN alumnas al ON al.seccion_id = s.id AND al.activa = true
LEFT JOIN asistencias a
       ON a.alumna_id = al.id
      AND a.fecha = (NOW() AT TIME ZONE 'America/Lima')::date
GROUP BY g.id, g.nombre, s.id, s.nombre
ORDER BY g.id, s.nombre;

-- ────────────────────────────────────────────────────────────
-- 9. Auditoría: se consulta por acción y fecha
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_auditoria_accion ON auditoria (accion, created_at DESC);

COMMIT;
