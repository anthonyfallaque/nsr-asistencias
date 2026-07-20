import { Request, Response } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import QRCode from 'qrcode';
import { query, queryOne } from '../db.js';

const AlumnaSchema = z.object({
  nombres: z.string().min(2).max(100),
  apellidos: z.string().min(2).max(100),
  dni: z.string().length(8).optional(),
  seccion_id: z.number().int().positive(),
  foto_url: z.string().url().optional(),
});

// ── Listar alumnas ───────────────────────────────────────────
export async function listar(req: Request, res: Response): Promise<void> {
  const { grado, seccion_id, buscar } = req.query;

  let sql = `
    SELECT al.id, al.nombres, al.apellidos, al.dni, al.foto_url, al.activa,
           g.nombre AS grado, s.nombre AS seccion, al.seccion_id
    FROM alumnas al
    JOIN secciones s ON s.id = al.seccion_id
    JOIN grados g    ON g.id = s.grado_id
    WHERE al.activa = true
  `;
  const params: unknown[] = [];

  if (grado) {
    params.push(grado);
    sql += ` AND g.nombre = $${params.length}`;
  }
  if (seccion_id) {
    params.push(Number(seccion_id));
    sql += ` AND al.seccion_id = $${params.length}`;
  }
  if (buscar) {
    params.push(`%${buscar}%`);
    sql += ` AND (al.nombres ILIKE $${params.length} OR al.apellidos ILIKE $${params.length} OR al.dni ILIKE $${params.length})`;
  }

  sql += ' ORDER BY al.apellidos, al.nombres';

  const rows = await query(sql, params);
  res.json(rows);
}

// ── Crear alumna ─────────────────────────────────────────────
export async function crear(req: Request, res: Response): Promise<void> {
  const parsed = AlumnaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten() });
    return;
  }

  const { nombres, apellidos, dni, seccion_id, foto_url } = parsed.data;
  const qr_token = randomBytes(24).toString('hex'); // 48 chars hex, sin datos personales

  const alumna = await queryOne<{ id: string; qr_token: string }>(
    `INSERT INTO alumnas (nombres, apellidos, dni, seccion_id, qr_token, foto_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, qr_token`,
    [nombres, apellidos, dni ?? null, seccion_id, qr_token, foto_url ?? null]
  );

  res.status(201).json(alumna);
}

// ── Obtener QR de una alumna ─────────────────────────────────
export async function obtenerQR(req: Request, res: Response): Promise<void> {
  const alumna = await queryOne<{ qr_token: string; nombres: string; apellidos: string; grado: string; seccion: string }>(
    `SELECT al.qr_token, al.nombres, al.apellidos, g.nombre AS grado, s.nombre AS seccion
     FROM alumnas al
     JOIN secciones s ON s.id = al.seccion_id
     JOIN grados g    ON g.id = s.grado_id
     WHERE al.id = $1 AND al.activa = true`,
    [req.params.id]
  );

  if (!alumna) { res.status(404).json({ error: 'Alumna no encontrada' }); return; }

  const qrDataUrl = await QRCode.toDataURL(alumna.qr_token, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: 'H',
  });

  res.json({
    qr_image: qrDataUrl,
    nombre_completo: `${alumna.apellidos}, ${alumna.nombres}`,
    grado: alumna.grado,
    seccion: alumna.seccion,
  });
}

// ── Actualizar alumna ────────────────────────────────────────
export async function actualizar(req: Request, res: Response): Promise<void> {
  const parsed = AlumnaSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos' });
    return;
  }

  const campos = parsed.data;
  const sets: string[] = [];
  const params: unknown[] = [req.params.id];

  if (campos.nombres)    { params.push(campos.nombres);    sets.push(`nombres = $${params.length}`); }
  if (campos.apellidos)  { params.push(campos.apellidos);  sets.push(`apellidos = $${params.length}`); }
  if (campos.dni)        { params.push(campos.dni);        sets.push(`dni = $${params.length}`); }
  if (campos.seccion_id) { params.push(campos.seccion_id); sets.push(`seccion_id = $${params.length}`); }
  if (campos.foto_url)   { params.push(campos.foto_url);   sets.push(`foto_url = $${params.length}`); }

  if (sets.length === 0) { res.status(400).json({ error: 'Sin campos para actualizar' }); return; }

  await query(
    `UPDATE alumnas SET ${sets.join(', ')} WHERE id = $1`,
    params
  );

  res.json({ ok: true });
}

// ── Dar de baja (soft delete) ────────────────────────────────
export async function desactivar(req: Request, res: Response): Promise<void> {
  await query(`UPDATE alumnas SET activa = false WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}

// ── Grados y secciones ───────────────────────────────────────
export async function listarGrados(_req: Request, res: Response): Promise<void> {
  const rows = await query(`SELECT id, nombre FROM grados ORDER BY id`);
  res.json(rows);
}

export async function listarSecciones(req: Request, res: Response): Promise<void> {
  const { grado_id } = req.query;
  const rows = await query(
    `SELECT s.id, s.nombre, g.nombre AS grado, g.id AS grado_id, u.nombre AS tutora
     FROM secciones s
     JOIN grados g ON g.id = s.grado_id
     LEFT JOIN usuarios u ON u.id = s.tutora_id
     ${grado_id ? 'WHERE s.grado_id = $1' : ''}
     ORDER BY g.id, s.nombre`,
    grado_id ? [Number(grado_id)] : []
  );
  res.json(rows);
}

// ── Importar alumnas en lote (CSV/JSON) ──────────────────────
const ImportSchema = z.array(AlumnaSchema);

export async function importarLote(req: Request, res: Response): Promise<void> {
  const parsed = ImportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Formato inválido', detalles: parsed.error.flatten() });
    return;
  }

  const resultados: { dni?: string; ok: boolean; error?: string }[] = [];

  for (const al of parsed.data) {
    try {
      const qr_token = randomBytes(24).toString('hex');
      await query(
        `INSERT INTO alumnas (nombres, apellidos, dni, seccion_id, qr_token)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (dni) DO NOTHING`,
        [al.nombres, al.apellidos, al.dni ?? null, al.seccion_id, qr_token]
      );
      resultados.push({ dni: al.dni, ok: true });
    } catch (e) {
      resultados.push({ dni: al.dni, ok: false, error: String(e) });
    }
  }

  res.json({ total: parsed.data.length, resultados });
}
