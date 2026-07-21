import { Request, Response } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db.js';
import type { EstadoAsistencia } from '../types/index.js';

// ── Escanear QR ──────────────────────────────────────────────
const EscaneoSchema = z.object({
  qr_token: z.string().min(10),
  scanned_at: z.string().datetime().optional(), // ISO, para offline sync
});

export async function escanear(req: Request, res: Response): Promise<void> {
  const parsed = EscaneoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Token QR inválido' });
    return;
  }

  const { qr_token, scanned_at } = parsed.data;
  const ahora = scanned_at ? new Date(scanned_at) : new Date();

  // Buscar alumna por token
  const alumna = await queryOne<{
    id: string; nombres: string; apellidos: string;
    foto_url: string | null; grado: string; seccion: string;
  }>(
    `SELECT al.id, al.nombres, al.apellidos, al.foto_url,
            g.nombre AS grado, s.nombre AS seccion
     FROM alumnas al
     JOIN secciones s ON s.id = al.seccion_id
     JOIN grados g    ON g.id = s.grado_id
     WHERE al.qr_token = $1 AND al.activa = true`,
    [qr_token]
  );

  if (!alumna) {
    res.status(404).json({ error: 'QR no reconocido' });
    return;
  }

  // Determinar estado según horario configurado
  const config = await queryOne<{ hora_entrada: string; minutos_tolerancia: number }>(
    `SELECT hora_entrada, minutos_tolerancia FROM configuracion_horario WHERE activo = true LIMIT 1`
  );

  let estado: EstadoAsistencia = 'puntual';
  if (config) {
    const [hh, mm] = config.hora_entrada.split(':').map(Number);
    const limite = new Date(ahora);
    limite.setHours(hh, mm + config.minutos_tolerancia, 0, 0);
    if (ahora > limite) estado = 'tardanza';
  }

  const fecha = ahora.toISOString().slice(0, 10); // YYYY-MM-DD

  // Insertar o ignorar (idempotencia)
  const rows = await query<{ id: string; estado: string; hora_escaneo: string }>(
    `INSERT INTO asistencias (alumna_id, fecha, hora_escaneo, estado, registrado_por, ip_origen)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (alumna_id, fecha) DO NOTHING
     RETURNING id, estado, hora_escaneo`,
    [alumna.id, fecha, ahora.toISOString(), estado, req.usuario!.id, req.ip]
  );

  const esNuevo = rows.length > 0;

  res.json({
    alumna: {
      nombres: alumna.nombres,
      apellidos: alumna.apellidos,
      foto_url: alumna.foto_url,
      grado: alumna.grado,
      seccion: alumna.seccion,
    },
    estado: esNuevo ? estado : 'ya_registrada',
    hora_escaneo: ahora.toISOString(),
    nuevo: esNuevo,
  });
}

// ── Sincronizar cola offline ─────────────────────────────────
const SyncSchema = z.array(z.object({
  qr_token: z.string(),
  scanned_at: z.string().datetime(),
}));

export async function sincronizarOffline(req: Request, res: Response): Promise<void> {
  const parsed = SyncSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Formato de cola inválido' });
    return;
  }

  const resultados = [];
  for (const item of parsed.data) {
    // Guardar en cola para procesamiento
    await query(
      `INSERT INTO cola_offline (qr_token, scanned_at, registrado_por)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [item.qr_token, item.scanned_at, req.usuario!.id]
    );

    // Procesar igual que un escaneo normal
    const fakeReq = { body: item, ip: req.ip, usuario: req.usuario } as Request;
    const tempRes = {
      status: () => tempRes,
      json: (data: unknown) => { resultados.push(data); },
    } as unknown as Response;

    // Reutilizar lógica de escaneo directamente
    const alumna = await queryOne<{
      id: string; nombres: string; apellidos: string;
    }>(
      `SELECT al.id, al.nombres, al.apellidos
       FROM alumnas al WHERE al.qr_token = $1 AND al.activa = true`,
      [item.qr_token]
    );

    if (!alumna) { resultados.push({ qr_token: item.qr_token, error: 'no_encontrada' }); continue; }

    const ahora = new Date(item.scanned_at);
    const config = await queryOne<{ hora_entrada: string; minutos_tolerancia: number }>(
      `SELECT hora_entrada, minutos_tolerancia FROM configuracion_horario WHERE activo = true LIMIT 1`
    );

    let estado: EstadoAsistencia = 'puntual';
    if (config) {
      const [hh, mm] = config.hora_entrada.split(':').map(Number);
      const limite = new Date(ahora);
      limite.setHours(hh, mm + config.minutos_tolerancia, 0, 0);
      if (ahora > limite) estado = 'tardanza';
    }

    const fecha = ahora.toISOString().slice(0, 10);
    await query(
      `INSERT INTO asistencias (alumna_id, fecha, hora_escaneo, estado, registrado_por)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (alumna_id, fecha) DO NOTHING`,
      [alumna.id, fecha, ahora.toISOString(), estado, req.usuario!.id]
    );

    resultados.push({ qr_token: item.qr_token, alumna: alumna.apellidos, estado });
  }

  await query(
    `UPDATE cola_offline SET processed = true, processed_at = NOW()
     WHERE qr_token = ANY($1::text[]) AND registrado_por = $2`,
    [parsed.data.map(i => i.qr_token), req.usuario!.id]
  );

  res.json({ procesados: resultados.length, resultados });
}

// ── Resumen del día ──────────────────────────────────────────
export async function resumenHoy(_req: Request, res: Response): Promise<void> {
  const resumen = await query(
    `SELECT * FROM v_resumen_seccion_hoy`
  );
  res.json(resumen);
}

// ── Asistencias de una sección hoy ──────────────────────────
export async function asistenciasSeccion(req: Request, res: Response): Promise<void> {
  const seccionId = Number(req.params.seccionId);
  if (isNaN(seccionId)) { res.status(400).json({ error: 'ID inválido' }); return; }

  const fecha = (req.query.fecha as string) ?? new Date().toISOString().slice(0, 10);

  const rows = await query(
    `SELECT al.id, al.nombres, al.apellidos, al.foto_url, al.dni,
            COALESCE(a.estado, 'ausente') AS estado,
            a.hora_escaneo, a.justificacion
     FROM alumnas al
     LEFT JOIN asistencias a ON a.alumna_id = al.id AND a.fecha = $2
     WHERE al.seccion_id = $1 AND al.activa = true
     ORDER BY al.apellidos, al.nombres`,
    [seccionId, fecha]
  );

  res.json(rows);
}

// ── Justificar ausencia ──────────────────────────────────────
const JustificaSchema = z.object({
  alumna_id: z.string().uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  justificacion: z.string().min(5).max(500),
});

export async function justificar(req: Request, res: Response): Promise<void> {
  const parsed = JustificaSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }

  const { alumna_id, fecha, justificacion } = parsed.data;

  await query(
    `INSERT INTO asistencias (alumna_id, fecha, estado, justificacion, registrado_por)
     VALUES ($1, $2, 'justificada', $3, $4)
     ON CONFLICT (alumna_id, fecha)
     DO UPDATE SET estado = 'justificada', justificacion = $3, registrado_por = $4, updated_at = NOW()`,
    [alumna_id, fecha, justificacion, req.usuario!.id]
  );

  res.json({ ok: true });
}

// ── Tendencia de asistencia (últimos N días) ─────────────────
export async function tendencia(req: Request, res: Response): Promise<void> {
  const dias = Math.min(Math.max(parseInt(String(req.query.dias)) || 7, 1), 30);

  const rows = await query<{
    dia: string; fecha: string;
    puntuales: number; tardanzas: number; justificadas: number; ausentes: number; total: number;
  }>(
    `SELECT
       TO_CHAR(d.fecha::date, 'DD/MM')                                               AS dia,
       d.fecha::date::text                                                            AS fecha,
       COALESCE(SUM(CASE WHEN a.estado = 'puntual'     THEN 1 ELSE 0 END), 0)::int  AS puntuales,
       COALESCE(SUM(CASE WHEN a.estado = 'tardanza'    THEN 1 ELSE 0 END), 0)::int  AS tardanzas,
       COALESCE(SUM(CASE WHEN a.estado = 'justificada' THEN 1 ELSE 0 END), 0)::int  AS justificadas,
       (COUNT(al.id) - COUNT(a.alumna_id))::int                                      AS ausentes,
       COUNT(al.id)::int                                                              AS total
     FROM generate_series(
       CURRENT_DATE - ($1 - 1) * INTERVAL '1 day',
       CURRENT_DATE,
       '1 day'::interval
     ) d(fecha)
     CROSS JOIN (SELECT id FROM alumnas WHERE activa = true) al
     LEFT JOIN asistencias a
       ON a.alumna_id = al.id AND a.fecha = d.fecha::date
     GROUP BY d.fecha
     ORDER BY d.fecha`,
    [dias]
  );

  res.json(rows);
}

// ── Marcar asistencia manual ──────────────────────────────────
const MarcarManualSchema = z.object({
  alumna_id:     z.string().uuid(),
  fecha:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  estado:        z.enum(['puntual', 'tardanza', 'ausente', 'justificada']),
  justificacion: z.string().min(3).max(500).optional(),
});

export async function marcarManual(req: Request, res: Response): Promise<void> {
  const parsed = MarcarManualSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten() });
    return;
  }

  const { alumna_id, fecha, estado, justificacion } = parsed.data;

  if (estado === 'ausente') {
    await query(
      `DELETE FROM asistencias WHERE alumna_id = $1 AND fecha = $2`,
      [alumna_id, fecha]
    );
  } else {
    await query(
      `INSERT INTO asistencias (alumna_id, fecha, hora_escaneo, estado, justificacion, registrado_por)
       VALUES ($1, $2, NOW(), $3, $4, $5)
       ON CONFLICT (alumna_id, fecha)
       DO UPDATE SET
         estado         = $3,
         justificacion  = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE asistencias.justificacion END,
         registrado_por = $5,
         updated_at     = NOW()`,
      [alumna_id, fecha, estado, justificacion ?? null, req.usuario!.id]
    );
  }

  res.json({ ok: true });
}
