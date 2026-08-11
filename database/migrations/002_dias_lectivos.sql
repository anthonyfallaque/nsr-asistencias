-- ════════════════════════════════════════════════════════════════════════
-- 002 · Calendario escolar
--
-- Motivo: la serie de tendencia se generaba con `generate_series` sobre
-- días naturales, de modo que sábados, domingos, feriados y vacaciones
-- aparecían con el 100 % de ausencia. Con el valor por defecto de 7 días,
-- dos de las siete barras eran siempre ruido y hundían la lectura.
--
-- El cliente puede deducir los fines de semana a partir de la fecha, pero
-- no los feriados (Perú tiene ~12 al año) ni las vacaciones: eso solo lo
-- sabe el colegio. Esta tabla es la fuente de verdad.
--
-- Idempotente: se puede ejecutar más de una vez sin efectos.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS dias_lectivos (
  fecha       DATE PRIMARY KEY,
  lectivo     BOOLEAN     NOT NULL DEFAULT true,
  -- Por qué no es lectivo. Nulo en un día normal de clases.
  motivo      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE dias_lectivos IS
  'Calendario escolar. Un día ausente de esta tabla se considera lectivo si '
  'cae de lunes a viernes: así el sistema funciona sin cargarlo entero, y '
  'cargarlo solo mejora la precisión.';

CREATE INDEX IF NOT EXISTS idx_dias_lectivos_no_lectivos
  ON dias_lectivos (fecha) WHERE NOT lectivo;

-- ── Feriados nacionales del Perú ────────────────────────────────────────
-- Fijos por ley (D.L. 713 y modificatorias). Los movibles —Jueves y
-- Viernes Santo— se incluyen para 2026 y 2027 con su fecha real.
INSERT INTO dias_lectivos (fecha, lectivo, motivo) VALUES
  ('2026-01-01', false, 'Año Nuevo'),
  ('2026-04-02', false, 'Jueves Santo'),
  ('2026-04-03', false, 'Viernes Santo'),
  ('2026-05-01', false, 'Día del Trabajo'),
  ('2026-06-07', false, 'Batalla de Arica'),
  ('2026-06-29', false, 'San Pedro y San Pablo'),
  ('2026-07-23', false, 'Día de la Fuerza Aérea'),
  ('2026-07-28', false, 'Fiestas Patrias'),
  ('2026-07-29', false, 'Fiestas Patrias'),
  ('2026-08-06', false, 'Batalla de Junín'),
  ('2026-08-30', false, 'Santa Rosa de Lima'),
  ('2026-10-08', false, 'Combate de Angamos'),
  ('2026-11-01', false, 'Todos los Santos'),
  ('2026-12-08', false, 'Inmaculada Concepción'),
  ('2026-12-09', false, 'Batalla de Ayacucho'),
  ('2026-12-25', false, 'Navidad'),
  ('2027-01-01', false, 'Año Nuevo'),
  ('2027-03-25', false, 'Jueves Santo'),
  ('2027-03-26', false, 'Viernes Santo'),
  ('2027-05-01', false, 'Día del Trabajo'),
  ('2027-06-07', false, 'Batalla de Arica'),
  ('2027-06-29', false, 'San Pedro y San Pablo'),
  ('2027-07-23', false, 'Día de la Fuerza Aérea'),
  ('2027-07-28', false, 'Fiestas Patrias'),
  ('2027-07-29', false, 'Fiestas Patrias'),
  ('2027-08-06', false, 'Batalla de Junín'),
  ('2027-08-30', false, 'Santa Rosa de Lima'),
  ('2027-10-08', false, 'Combate de Angamos'),
  ('2027-11-01', false, 'Todos los Santos'),
  ('2027-12-08', false, 'Inmaculada Concepción'),
  ('2027-12-09', false, 'Batalla de Ayacucho'),
  ('2027-12-25', false, 'Navidad')
ON CONFLICT (fecha) DO NOTHING;

-- ── Fines de semana ─────────────────────────────────────────────────────
-- Se materializan para que una sola consulta resuelva "¿hubo clases?" sin
-- mezclar la lógica del calendario con EXTRACT(DOW) repartido por el SQL.
INSERT INTO dias_lectivos (fecha, lectivo, motivo)
SELECT d::date, false, 'Fin de semana'
  FROM generate_series('2026-01-01'::date, '2027-12-31'::date, '1 day') d
 WHERE EXTRACT(ISODOW FROM d) IN (6, 7)
ON CONFLICT (fecha) DO NOTHING;

COMMIT;
