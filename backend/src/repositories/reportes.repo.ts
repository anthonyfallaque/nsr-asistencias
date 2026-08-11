import { Ejecutor, fila, filas, pool } from '../db.js';
import { filtroAmbito } from '../middleware/scope.js';
import type { EstadoAsistencia } from '../types/index.js';
import { ESTADO, HORA_LOCAL, JOIN_SECCION_HISTORICA } from './sql.js';

export interface FilaReporte {
  apellidos: string;
  nombres: string;
  dni: string | null;
  grado: string;
  seccion: string;
  fecha: string | null;
  estado: EstadoAsistencia;
  hora: string | null;
}

/**
 * Detalle por alumna y día dentro de un rango, paginado.
 *
 * Sin LIMIT esto devolvía hasta 800 alumnas × 180 días ≈ 144.000 filas
 * en un único JSON, suficiente para tumbar el proceso por memoria.
 *
 * Grado y sección salen de `asistencias.seccion_id` (la sección que
 * tenía la alumna ese día) y sólo caen a su sección actual cuando ese
 * día no hay registro.
 */
export async function reporteRango(
  datos: {
    desde: string;
    hasta: string;
    grado?: string;
    seccionId?: number;
    ambito: number[] | null;
    limite: number;
    desplazamiento: number;
  },
  ex: Ejecutor = pool
): Promise<{ filas: FilaReporte[]; total: number }> {
  const params: unknown[] = [datos.desde, datos.hasta, datos.ambito];
  let filtros = '';

  if (datos.grado) {
    params.push(datos.grado);
    filtros += ` AND g.nombre = $${params.length}`;
  }
  if (datos.seccionId !== undefined) {
    params.push(datos.seccionId);
    filtros += ` AND al.seccion_id = $${params.length}`;
  }

  const base = `
       FROM alumnas al
       LEFT JOIN asistencias a
              ON a.alumna_id = al.id AND a.fecha BETWEEN $1::date AND $2::date
       ${JOIN_SECCION_HISTORICA}
      WHERE al.activa = true
        AND ${filtroAmbito('al.seccion_id', 3)}${filtros}`;

  const totalRow = await fila<{ total: string }>(
    ex,
    `SELECT COUNT(*)::text AS total ${base}`,
    params
  );
  const total = Number(totalRow?.total ?? 0);

  params.push(datos.limite, datos.desplazamiento);

  const rows = await filas<FilaReporte>(
    ex,
    `SELECT al.apellidos, al.nombres, al.dni,
            g.nombre AS grado, s.nombre AS seccion,
            TO_CHAR(a.fecha, 'DD/MM/YYYY') AS fecha,
            ${ESTADO()} AS estado,
            ${HORA_LOCAL()} AS hora
       ${base}
      ORDER BY g.id, s.nombre, al.apellidos, al.nombres, a.fecha
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { filas: rows, total };
}

export interface DiaAlumna {
  fecha: string;
  estado: EstadoAsistencia;
  hora: string | null;
}

/**
 * Días lectivos del periodo para una alumna.
 *
 * "Día lectivo" = día en el que el colegio registró alguna asistencia.
 * Sin esa referencia no hay forma de distinguir una ausencia de un
 * domingo; y contar `estado = 'ausente'` sobre las filas existentes
 * daba siempre 0, porque la ausencia no se persiste salvo que alguien
 * la marque a mano.
 *
 * Devuelve null si la alumna no existe o queda fuera del ámbito.
 */
export async function diasDeAlumna(
  datos: { alumnaId: string; desde: string; hasta: string; ambito: number[] | null },
  ex: Ejecutor = pool
): Promise<DiaAlumna[] | null> {
  const alumna = await fila<{ id: string }>(
    ex,
    `SELECT al.id FROM alumnas al
      WHERE al.id = $1 AND ${filtroAmbito('al.seccion_id', 2)}`,
    [datos.alumnaId, datos.ambito]
  );
  if (!alumna) return null;

  // Rango semiabierto [desde, hasta): sargable, usa idx_asistencias_fecha.
  // Antes se filtraba con EXTRACT(MONTH FROM a.fecha), que impide el índice.
  return filas<DiaAlumna>(
    ex,
    `WITH lectivos AS (
       SELECT DISTINCT fecha FROM asistencias
        WHERE fecha >= $2::date AND fecha < $3::date
     )
     SELECT l.fecha::text AS fecha,
            ${ESTADO()} AS estado,
            ${HORA_LOCAL()} AS hora
       FROM lectivos l
       LEFT JOIN asistencias a ON a.alumna_id = $1 AND a.fecha = l.fecha
      ORDER BY l.fecha`,
    [datos.alumnaId, datos.desde, datos.hasta]
  );
}

export interface FilaRanking {
  alumna_id: string;
  apellidos: string;
  nombres: string;
  grado: string;
  seccion: string;
  tardanzas: number;
  ausencias: number;
}

export async function rankingTardanzas(
  datos: { desde: string; hasta: string; ambito: number[] | null; limite: number },
  ex: Ejecutor = pool
): Promise<FilaRanking[]> {
  return filas<FilaRanking>(
    ex,
    `WITH lectivos AS (
       SELECT DISTINCT fecha FROM asistencias
        WHERE fecha BETWEEN $1::date AND $2::date
     ),
     alumnado AS (
       SELECT al.id, al.apellidos, al.nombres, al.seccion_id
         FROM alumnas al
        WHERE al.activa = true AND ${filtroAmbito('al.seccion_id', 3)}
     )
     SELECT al.id AS alumna_id, al.apellidos, al.nombres,
            g.nombre AS grado, s.nombre AS seccion,
            COUNT(a.id) FILTER (WHERE a.estado = 'tardanza')::int      AS tardanzas,
            COUNT(l.fecha) FILTER (WHERE ${ESTADO()} = 'ausente')::int AS ausencias
       FROM alumnado al
       CROSS JOIN lectivos l
       LEFT JOIN asistencias a ON a.alumna_id = al.id AND a.fecha = l.fecha
       JOIN secciones s ON s.id = al.seccion_id
       JOIN grados g    ON g.id = s.grado_id
      GROUP BY al.id, al.apellidos, al.nombres, g.id, g.nombre, s.nombre
     HAVING COUNT(a.id) FILTER (WHERE a.estado = 'tardanza') > 0
         OR COUNT(l.fecha) FILTER (WHERE ${ESTADO()} = 'ausente') > 0
      ORDER BY tardanzas DESC, ausencias DESC, al.apellidos
      LIMIT $4`,
    [datos.desde, datos.hasta, datos.ambito, datos.limite]
  );
}
