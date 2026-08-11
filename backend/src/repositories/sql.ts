/**
 * Fragmentos SQL compartidos.
 *
 * El JOIN alumnas → secciones → grados estaba copiado en seis consultas
 * y el cálculo de puntualidad, literalmente duplicado. Aquí vive una
 * sola vez cada uno.
 */

/** Zona horaria del colegio, tal y como se escribe dentro del SQL. */
export const TZ = `'America/Lima'`;

/** Fecha de hoy en Lima, calculada por la base de datos. */
export const HOY_LIMA = `(NOW() AT TIME ZONE ${TZ})::date`;

/**
 * Estado efectivo de una asistencia.
 *
 * Representación única de la ausencia: no haber fila y tener una fila
 * con estado 'ausente' significan lo mismo y cuentan igual. Toda lectura
 * pasa por aquí para que ambas formas coincidan.
 */
export const ESTADO = (alias = 'a') =>
  `COALESCE(${alias}.estado, 'ausente'::estado_asistencia)`;

/**
 * Sección con la que se resuelve grado/sección de una asistencia.
 *
 * Primero la congelada en la propia asistencia (histórico correcto tras
 * promover de grado) y sólo si no hay registro, la sección actual de la
 * alumna.
 */
export const JOIN_SECCION_HISTORICA = `
  JOIN secciones s ON s.id = COALESCE(a.seccion_id, al.seccion_id)
  JOIN grados g    ON g.id = s.grado_id`;

/** Sección actual de la alumna (altas, listados, códigos QR). */
export const JOIN_SECCION_ACTUAL = `
  JOIN secciones s ON s.id = al.seccion_id
  JOIN grados g    ON g.id = s.grado_id`;

/** Hora local del escaneo, ya formateada para mostrar. */
export const HORA_LOCAL = (columna = 'a.hora_escaneo') =>
  `TO_CHAR(${columna} AT TIME ZONE ${TZ}, 'HH24:MI')`;

/**
 * Estado calculado a partir del momento del escaneo y la configuración
 * de horario, todo dentro de Postgres y anclado a America/Lima.
 *
 * Antes se calculaba en Node con `setHours()` (zona horaria del proceso)
 * y la fecha con `toISOString()` (siempre UTC): con el proceso en UTC,
 * el corte de las 07:45 de Lima se comparaba contra las 12:45 UTC y
 * TODAS las alumnas quedaban en tardanza.
 *
 * Parámetros esperados: $momento (timestamptz o NULL → NOW()),
 * $horaEntrada (time), $tolerancia (int, minutos).
 */
export const CALCULO_ESTADO = (pMomento: number, pHoraEntrada: number, pTolerancia: number) => `
  SELECT
    COALESCE($${pMomento}::timestamptz, NOW())                                       AS momento,
    (COALESCE($${pMomento}::timestamptz, NOW()) AT TIME ZONE ${TZ})::date            AS fecha,
    CASE
      WHEN (COALESCE($${pMomento}::timestamptz, NOW()) AT TIME ZONE ${TZ})::time
           > ($${pHoraEntrada}::time + make_interval(mins => $${pTolerancia}::int))
      THEN 'tardanza'::estado_asistencia
      ELSE 'puntual'::estado_asistencia
    END                                                                              AS estado`;
