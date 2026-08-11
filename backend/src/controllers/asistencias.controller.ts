import { Request, Response } from 'express';
import { z } from 'zod';
import { ambitoDe } from '../middleware/scope.js';
import { bodyDe, fechaIso, idEntero, paramsDe, queryDe } from '../middleware/validate.js';
import * as servicio from '../services/asistencias.service.js';

// ── Esquemas ─────────────────────────────────────────────────

export const EscaneoSchema = z.object({
  qr_token: z.string().min(10).max(64),
  // `scanned_at` se acepta por compatibilidad con el cliente actual,
  // pero se IGNORA: la hora la pone el servidor. Aceptarla permitía
  // falsificar la hora de llegada editando la petición.
  scanned_at: z.string().optional(),
});

export const SyncSchema = z
  .array(
    z.object({
      qr_token: z.string().min(10).max(64),
      scanned_at: z.string().datetime({ offset: true }),
    })
  )
  .max(1000, 'La cola no puede superar los 1000 elementos por envío');

export const ResumenQuerySchema = z.object({
  fecha: fechaIso.optional(),
});

export const SeccionParamsSchema = z.object({ seccionId: idEntero });
export const SeccionQuerySchema = z.object({ fecha: fechaIso.optional() });

export const TendenciaQuerySchema = z.object({
  dias: z.coerce.number().int().min(1).max(30).default(7),
});

export const JustificarSchema = z.object({
  alumna_id: z.string().uuid(),
  fecha: fechaIso,
  justificacion: z.string().trim().min(5).max(500),
});

export const MarcarManualSchema = z.object({
  alumna_id: z.string().uuid(),
  fecha: fechaIso,
  estado: z.enum(['puntual', 'tardanza', 'ausente', 'justificada']),
  justificacion: z.string().trim().min(3).max(500).optional(),
});

// ── Controladores ────────────────────────────────────────────

export async function escanear(req: Request, res: Response): Promise<void> {
  const { qr_token } = bodyDe<z.infer<typeof EscaneoSchema>>(req);

  const resultado = await servicio.escanear({
    qrToken: qr_token,
    registradoPor: req.usuario!.id,
    ip: req.ip,
  });

  res.json(resultado);
}

export async function sincronizarOffline(req: Request, res: Response): Promise<void> {
  const elementos = bodyDe<z.infer<typeof SyncSchema>>(req);

  const resultado = await servicio.sincronizarOffline({
    elementos,
    registradoPor: req.usuario!.id,
    ip: req.ip,
  });

  // 207 cuando parte del lote falló: el cliente debe poder distinguir
  // "todo bien" de "hay elementos que revisar" sin perder los buenos.
  res.status(resultado.fallidos > 0 ? 207 : 200).json(resultado);
}

export async function resumen(req: Request, res: Response): Promise<void> {
  const { fecha } = queryDe<z.infer<typeof ResumenQuerySchema>>(req);

  const { secciones } = await servicio.resumen(fecha, ambitoDe(req));

  // Se mantiene el array plano que consume el panel.
  res.json(secciones);
}

export async function asistenciasSeccion(req: Request, res: Response): Promise<void> {
  const { seccionId } = paramsDe<z.infer<typeof SeccionParamsSchema>>(req);
  const { fecha } = queryDe<z.infer<typeof SeccionQuerySchema>>(req);

  res.json(await servicio.porSeccion({ seccionId, fecha, ambito: ambitoDe(req) }));
}

export async function tendencia(req: Request, res: Response): Promise<void> {
  const { dias } = queryDe<z.infer<typeof TendenciaQuerySchema>>(req);
  res.json(await servicio.tendencia(dias, ambitoDe(req)));
}

export async function justificar(req: Request, res: Response): Promise<void> {
  const { alumna_id, fecha, justificacion } = bodyDe<z.infer<typeof JustificarSchema>>(req);

  const asistencia = await servicio.justificar({
    alumnaId: alumna_id,
    fecha,
    justificacion,
    usuarioId: req.usuario!.id,
    ip: req.ip,
    ambito: ambitoDe(req),
  });

  res.json({ ok: true, asistencia });
}

export async function marcarManual(req: Request, res: Response): Promise<void> {
  const { alumna_id, fecha, estado, justificacion } =
    bodyDe<z.infer<typeof MarcarManualSchema>>(req);

  const asistencia = await servicio.marcarManual({
    alumnaId: alumna_id,
    fecha,
    estado,
    justificacion,
    usuarioId: req.usuario!.id,
    ip: req.ip,
    ambito: ambitoDe(req),
  });

  res.json({ ok: true, asistencia });
}
