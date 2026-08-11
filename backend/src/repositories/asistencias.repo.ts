import { Ejecutor, fila, filas, pool } from '../db.js';
import { filtroAmbito } from '../middleware/scope.js';
import type { EstadoAsistencia, OrigenAsistencia, ResumenSeccion } from '../types/index.js';
import { CALCULO_ESTADO, ESTADO } from './sql.js';

// ── Búsqueda por QR ──────────────────────────────────────────

export interface AlumnaEscaneada {
  id: string;
  nombres: string;
  apellidos: string;
  foto_url: string | null;
  seccion_id: number;
  grado: string;
  seccion: string;
  /** Sólo relevante en la sincronización offline. */
  en_rango: boolean;
}

/**
 * Localiza a la alumna por su token QR y, de paso, comprueba en la
 * propia base de datos si el momento declarado por el cliente cae dentro
 * de la ventana aceptable.
 */
export async function buscarPorQr(
  qrToken: string,
  momento: string | null,
  ex: Ejecutor = pool
): Promise<AlumnaEscaneada | null> {
  return fila<AlumnaEscaneada>(
    ex,
    `SELECT al.id, al.nombres, al.apellidos, al.foto_url, al.seccion_id,
            g.nombre AS grado, s.nombre AS seccion,
            ($2::timestamptz IS NULL
             OR $2::timestamptz BETWEEN NOW() - INTERVAL '24 hours'
                                    AND NOW() + INTERVAL '5 minutes') AS en_rango
       FROM alumnas al
       JOIN secciones s ON s.id = al.seccion_id
       JOIN grados g    ON g.id = s.grado_id
      WHERE al.qr_token = $1 AND al.activa = true`,
    [qrToken, momento]
  );
}

// ── Registro de asistencia por escaneo ───────────────────────

export interface ResultadoRegistro {
  fecha: string;
  momento: string;
  estado_calculado: EstadoAsistencia;
  nuevo: boolean;
  estado_existente: EstadoAsistencia | null;
  hora_existente: string | null;
}

/**
 * Registra un escaneo de forma idempotente.
 *
 * Fecha y estado se calculan en SQL sobre America/Lima. `momento` es
 * NULL en el escaneo en vivo (manda el reloj del servidor) y sólo la
 * sincronización offline aporta un valor, ya acotado.
 *
 * Una sola ida y vuelta: el CTE devuelve el cálculo, lo insertado y,
 * si ya existía, la fila previa (el CTE ve la instantánea anterior a
 * la inserción, así que ambos no pueden aparecer a la vez).
 */
export async function registrarEscaneo(
  ex: Ejecutor,
  datos: {
    alumnaId: string;
    momento: string | null;
    horaEntrada: string;
    tolerancia: number;
    origen: OrigenAsistencia;
    registradoPor: string;
    ip?: string | null;
  }
): Promise<ResultadoRegistro> {
  const resultado = await fila<{
    fecha: string;
    momento: string;
    estado_calculado: EstadoAsistencia;
    id_insertado: string | null;
    estado_existente: EstadoAsistencia | null;
    hora_existente: string | null;
  }>(
    ex,
    `WITH calc AS (
       ${CALCULO_ESTADO(2, 3, 4)}
     ),
     insertada AS (
       INSERT INTO asistencias
         (alumna_id, fecha, hora_escaneo, estado, registrado_por, ip_origen, seccion_id, origen)
       SELECT al.id, c.fecha, c.momento, c.estado, $5, $6, al.seccion_id, $7::origen_asistencia
         FROM calc c
         JOIN alumnas al ON al.id = $1
       ON CONFLICT (alumna_id, fecha) DO NOTHING
       RETURNING id
     )
     SELECT c.fecha::text                       AS fecha,
            c.momento                           AS momento,
            c.estado                            AS estado_calculado,
            i.id                                AS id_insertado,
            previa.estado                       AS estado_existente,
            previa.hora_escaneo                 AS hora_existente
       FROM calc c
       LEFT JOIN insertada i ON true
       LEFT JOIN asistencias previa
              ON previa.alumna_id = $1 AND previa.fecha = c.fecha`,
    [
      datos.alumnaId,
      datos.momento,
      datos.horaEntrada,
      datos.tolerancia,
      datos.registradoPor,
      datos.ip ?? null,
      datos.origen,
    ]
  );

  if (!resultado) {
    // No debería ocurrir: el CTE siempre devuelve la fila de cálculo.
    throw new Error('El registro de asistencia no devolvió resultado');
  }

  return {
    fecha: resultado.fecha,
    momento: resultado.momento,
    estado_calculado: resultado.estado_calculado,
    nuevo: resultado.id_insertado !== null,
    estado_existente: resultado.estado_existente,
    hora_existente: resultado.hora_existente,
  };
}

// ── Cola offline ─────────────────────────────────────────────

export async function encolarOffline(
  ex: Ejecutor,
  datos: { qrToken: string; scannedAt: string; registradoPor: string }
): Promise<string | null> {
  const row = await fila<{ id: string }>(
    ex,
    `INSERT INTO cola_offline (qr_token, scanned_at, registrado_por)
     VALUES ($1, $2, $3)
     ON CONFLICT (qr_token, scanned_at) DO UPDATE
        SET registrado_por = COALESCE(cola_offline.registrado_por, EXCLUDED.registrado_por)
     RETURNING id`,
    [datos.qrToken, datos.scannedAt, datos.registradoPor]
  );
  return row?.id ?? null;
}

/** Marca por id de fila, no por token: el token se repite entre días. */
export async function marcarColaProcesada(ex: Ejecutor, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await filas(
    ex,
    `UPDATE cola_offline
        SET processed = true, processed_at = NOW()
      WHERE id = ANY($1::uuid[])`,
    [ids]
  );
}

// ── Mutaciones manuales ──────────────────────────────────────

export interface AsistenciaGuardada {
  id: string;
  alumna_id: string;
  fecha: string;
  estado: EstadoAsistencia;
  origen: OrigenAsistencia;
  justificacion: string | null;
  hora_escaneo: string | null;
  seccion_id: number | null;
}

/**
 * Estado actual de la asistencia de una alumna en una fecha, para dejar
 * el "antes" en la auditoría. Devuelve null si la alumna no existe o
 * queda fuera del ámbito del usuario.
 */
export async function estadoPrevio(
  ex: Ejecutor,
  datos: { alumnaId: string; fecha: string; ambito: number[] | null }
): Promise<{ existe_alumna: boolean; asistencia: AsistenciaGuardada | null } | null> {
  const row = await fila<{
    alumna_id: string;
    id: string | null;
    fecha: string | null;
    estado: EstadoAsistencia | null;
    origen: OrigenAsistencia | null;
    justificacion: string | null;
    hora_escaneo: string | null;
    seccion_id: number | null;
  }>(
    ex,
    `SELECT al.id AS alumna_id,
            a.id, a.fecha::text AS fecha, a.estado, a.origen,
            a.justificacion, a.hora_escaneo, a.seccion_id
       FROM alumnas al
       LEFT JOIN asistencias a ON a.alumna_id = al.id AND a.fecha = $2::date
      WHERE al.id = $1 AND al.activa = true
        AND ${filtroAmbito('al.seccion_id', 3)}`,
    [datos.alumnaId, datos.fecha, datos.ambito]
  );

  if (!row) return null;

  return {
    existe_alumna: true,
    asistencia: row.id
      ? {
          id: row.id,
          alumna_id: row.alumna_id,
          fecha: row.fecha as string,
          estado: row.estado as EstadoAsistencia,
          origen: row.origen as OrigenAsistencia,
          justificacion: row.justificacion,
          hora_escaneo: row.hora_escaneo,
          seccion_id: row.seccion_id,
        }
      : null,
  };
}

/**
 * Alta o modificación manual de una asistencia.
 *
 * La pertenencia al ámbito se comprueba DENTRO del propio INSERT: la
 * fuente de la inserción es un SELECT sobre `alumnas` filtrado por
 * ámbito, así que una tutora que envíe el id de una alumna ajena
 * simplemente no afecta a ninguna fila (y recibe un 404).
 *
 * `seccion_id` se toma de la alumna al crear y NO se reescribe al
 * actualizar: la asistencia conserva la sección que tenía ese día.
 */
export async function guardarManual(
  ex: Ejecutor,
  datos: {
    alumnaId: string;
    fecha: string;
    estado: EstadoAsistencia;
    justificacion?: string | null;
    registradoPor: string;
    ip?: string | null;
    ambito: number[] | null;
  }
): Promise<AsistenciaGuardada | null> {
  return fila<AsistenciaGuardada>(
    ex,
    `INSERT INTO asistencias
       (alumna_id, fecha, hora_escaneo, estado, justificacion,
        registrado_por, ip_origen, seccion_id, origen)
     SELECT al.id,
            $2::date,
            CASE WHEN $3::estado_asistencia IN ('puntual', 'tardanza') THEN NOW() END,
            $3::estado_asistencia,
            $4,
            $5,
            $6,
            al.seccion_id,
            'manual'::origen_asistencia
       FROM alumnas al
      WHERE al.id = $1 AND al.activa = true
        AND ${filtroAmbito('al.seccion_id', 7)}
     ON CONFLICT (alumna_id, fecha) DO UPDATE SET
       estado         = EXCLUDED.estado,
       justificacion  = COALESCE(EXCLUDED.justificacion, asistencias.justificacion),
       hora_escaneo   = CASE
                          WHEN EXCLUDED.estado = 'ausente' THEN NULL
                          ELSE COALESCE(asistencias.hora_escaneo, EXCLUDED.hora_escaneo)
                        END,
       registrado_por = EXCLUDED.registrado_por,
       ip_origen      = EXCLUDED.ip_origen,
       origen         = 'manual'::origen_asistencia,
       seccion_id     = COALESCE(asistencias.seccion_id, EXCLUDED.seccion_id),
       updated_at     = NOW()
     RETURNING id, alumna_id, fecha::text AS fecha, estado, origen,
               justificacion, hora_escaneo, seccion_id`,
    [
      datos.alumnaId,
      datos.fecha,
      datos.estado,
      datos.justificacion ?? null,
      datos.registradoPor,
      datos.ip ?? null,
      datos.ambito,
    ]
  );
}

// ── Consultas de lectura ─────────────────────────────────────

/**
 * Resumen por sección de una fecha concreta.
 *
 * Sustituye a `SELECT * FROM v_resumen_seccion_hoy`, que estaba clavado
 * a hoy e ignoraba el selector de fecha del panel. LEFT JOIN sobre
 * alumnas para que una sección sin alumnas siga apareciendo.
 */
export async function resumenPorSeccion(
  fecha: string,
  ambito: number[] | null,
  ex: Ejecutor = pool
): Promise<ResumenSeccion[]> {
  return filas<ResumenSeccion>(
    ex,
    `SELECT g.nombre       AS grado,
            s.nombre       AS seccion,
            s.id           AS seccion_id,
            COUNT(al.id)::int AS total,
            COUNT(a.id) FILTER (WHERE a.estado = 'puntual')::int     AS puntuales,
            COUNT(a.id) FILTER (WHERE a.estado = 'tardanza')::int    AS tardanzas,
            COUNT(a.id) FILTER (WHERE a.estado = 'justificada')::int AS justificadas,
            COUNT(al.id) FILTER (WHERE ${ESTADO()} = 'ausente')::int AS ausentes
       FROM secciones s
       JOIN grados g ON g.id = s.grado_id
       LEFT JOIN alumnas al ON al.seccion_id = s.id AND al.activa = true
       LEFT JOIN asistencias a ON a.alumna_id = al.id AND a.fecha = $1::date
      WHERE ${filtroAmbito('s.id', 2)}
      GROUP BY g.id, g.nombre, s.id, s.nombre
      ORDER BY g.id, s.nombre`,
    [fecha, ambito]
  );
}

export interface AsistenciaDeSeccion {
  id: string;
  nombres: string;
  apellidos: string;
  foto_url: string | null;
  dni: string | null;
  estado: EstadoAsistencia;
  hora_escaneo: string | null;
  justificacion: string | null;
}

export async function porSeccion(
  datos: { seccionId: number; fecha: string; ambito: number[] | null },
  ex: Ejecutor = pool
): Promise<AsistenciaDeSeccion[]> {
  return filas<AsistenciaDeSeccion>(
    ex,
    `SELECT al.id, al.nombres, al.apellidos, al.foto_url, al.dni,
            ${ESTADO()} AS estado,
            a.hora_escaneo, a.justificacion
       FROM alumnas al
       LEFT JOIN asistencias a ON a.alumna_id = al.id AND a.fecha = $2::date
      WHERE al.seccion_id = $1 AND al.activa = true
        AND ${filtroAmbito('al.seccion_id', 3)}
      ORDER BY al.apellidos, al.nombres`,
    [datos.seccionId, datos.fecha, datos.ambito]
  );
}

export interface TendenciaDia {
  dia: string;
  fecha: string;
  puntuales: number;
  tardanzas: number;
  justificadas: number;
  ausentes: number;
  total: number;
}

/**
 * Serie de los últimos N días, anclada al día de hoy en Lima.
 * Los días sin registro para una alumna cuentan como ausencia.
 */
export async function tendencia(
  datos: { dias: number; ambito: number[] | null },
  ex: Ejecutor = pool
): Promise<TendenciaDia[]> {
  return filas<TendenciaDia>(
    ex,
    /**
     * Se devuelven los últimos N días LECTIVOS, no los últimos N naturales.
     *
     * Antes la serie salía de un generate_series sobre días corridos, así
     * que sábados, domingos y feriados aparecían con el 100 % de ausencia:
     * con el valor por defecto de 7 días, dos barras de siete eran ruido.
     *
     * Un día cuenta como lectivo salvo que `dias_lectivos` diga lo
     * contrario, de modo que el sistema sigue funcionando aunque la tabla
     * esté vacía y cargarla solo mejora la precisión.
     *
     * La ventana de búsqueda es el triple de N para que quepan fines de
     * semana y feriados seguidos y aun así se completen los N días.
     */
    `WITH dias AS (
       SELECT fecha FROM (
         SELECT d::date AS fecha
           FROM generate_series(
             (NOW() AT TIME ZONE 'America/Lima')::date - ($1::int * 3),
             (NOW() AT TIME ZONE 'America/Lima')::date,
             '1 day'::interval
           ) d
          WHERE NOT EXISTS (
            SELECT 1 FROM dias_lectivos dl
             WHERE dl.fecha = d::date AND dl.lectivo = false
          )
          ORDER BY d DESC
          LIMIT $1::int
       ) ultimos
     ),
     alumnado AS (
       SELECT id, seccion_id FROM alumnas
        WHERE activa = true AND ${filtroAmbito('seccion_id', 2)}
     )
     SELECT TO_CHAR(d.fecha, 'DD/MM')                          AS dia,
            d.fecha::text                                      AS fecha,
            COUNT(a.id) FILTER (WHERE a.estado = 'puntual')::int     AS puntuales,
            COUNT(a.id) FILTER (WHERE a.estado = 'tardanza')::int    AS tardanzas,
            COUNT(a.id) FILTER (WHERE a.estado = 'justificada')::int AS justificadas,
            COUNT(al.id) FILTER (WHERE ${ESTADO()} = 'ausente')::int AS ausentes,
            COUNT(al.id)::int                                        AS total
       FROM dias d
       CROSS JOIN alumnado al
       LEFT JOIN asistencias a ON a.alumna_id = al.id AND a.fecha = d.fecha
      GROUP BY d.fecha
      ORDER BY d.fecha`,
    [datos.dias, datos.ambito]
  );
}

// Los reportes por rango, por alumna y el ranking viven en
// repositories/reportes.repo.ts
