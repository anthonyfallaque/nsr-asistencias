import { Request, Response } from 'express';
import { query } from '../db.js';

// ── Reporte por rango de fechas ──────────────────────────────
export async function reporteRango(req: Request, res: Response): Promise<void> {
  const { desde, hasta, grado, seccion_id } = req.query as Record<string, string>;

  if (!desde || !hasta) {
    res.status(400).json({ error: 'Parámetros desde y hasta son requeridos' });
    return;
  }

  let sql = `
    SELECT
      al.apellidos,
      al.nombres,
      al.dni,
      g.nombre  AS grado,
      s.nombre  AS seccion,
      TO_CHAR(a.fecha, 'DD/MM/YYYY') AS fecha,
      a.estado,
      TO_CHAR(a.hora_escaneo AT TIME ZONE 'America/Lima', 'HH24:MI') AS hora
    FROM alumnas al
    JOIN secciones s ON s.id = al.seccion_id
    JOIN grados g    ON g.id = s.grado_id
    LEFT JOIN asistencias a ON a.alumna_id = al.id AND a.fecha BETWEEN $1 AND $2
    WHERE al.activa = true
  `;
  const params: unknown[] = [desde, hasta];

  if (grado) {
    params.push(grado);
    sql += ` AND g.nombre = $${params.length}`;
  }
  if (seccion_id) {
    params.push(Number(seccion_id));
    sql += ` AND al.seccion_id = $${params.length}`;
  }

  sql += ' ORDER BY g.id, s.nombre, al.apellidos, a.fecha';

  const rows = await query(sql, params);
  res.json(rows);
}

// ── Estadísticas mensuales de una alumna ────────────────────
export async function estadisticasAlumna(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { mes, anio } = req.query as Record<string, string>;

  const rows = await query(
    `SELECT
       a.fecha,
       a.estado,
       TO_CHAR(a.hora_escaneo AT TIME ZONE 'America/Lima', 'HH24:MI') AS hora
     FROM asistencias a
     WHERE a.alumna_id = $1
       AND EXTRACT(MONTH FROM a.fecha) = $2
       AND EXTRACT(YEAR  FROM a.fecha) = $3
     ORDER BY a.fecha`,
    [id, mes ?? new Date().getMonth() + 1, anio ?? new Date().getFullYear()]
  );

  const resumen = {
    total_dias: rows.length,
    puntuales:    rows.filter(r => r.estado === 'puntual').length,
    tardanzas:    rows.filter(r => r.estado === 'tardanza').length,
    justificadas: rows.filter(r => r.estado === 'justificada').length,
    ausentes:     rows.filter(r => r.estado === 'ausente').length,
    detalle: rows,
  };

  res.json(resumen);
}

// ── Ranking de tardanzas por sección ────────────────────────
export async function rankingTardanzas(req: Request, res: Response): Promise<void> {
  const { desde, hasta } = req.query as Record<string, string>;
  const rows = await query(
    `SELECT
       al.apellidos, al.nombres,
       g.nombre AS grado, s.nombre AS seccion,
       COUNT(*) FILTER (WHERE a.estado = 'tardanza')  AS tardanzas,
       COUNT(*) FILTER (WHERE a.estado = 'ausente')   AS ausencias
     FROM alumnas al
     JOIN secciones s ON s.id = al.seccion_id
     JOIN grados g    ON g.id = s.grado_id
     LEFT JOIN asistencias a ON a.alumna_id = al.id
       AND ($1::date IS NULL OR a.fecha >= $1)
       AND ($2::date IS NULL OR a.fecha <= $2)
     WHERE al.activa = true
     GROUP BY al.id, al.apellidos, al.nombres, g.nombre, s.nombre
     HAVING COUNT(*) FILTER (WHERE a.estado IN ('tardanza', 'ausente')) > 0
     ORDER BY tardanzas DESC, ausencias DESC
     LIMIT 50`,
    [desde ?? null, hasta ?? null]
  );

  res.json(rows);
}
