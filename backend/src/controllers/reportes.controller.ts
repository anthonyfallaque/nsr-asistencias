import { Request, Response } from 'express';
import { z } from 'zod';
import { ambitoDe } from '../middleware/scope.js';
import { fechaIso, idEntero, idUuid, paginacion, paramsDe, queryDe } from '../middleware/validate.js';
import { hoyEnLima, sumarDias } from '../services/horario.service.js';
import * as servicio from '../services/reportes.service.js';

// ── Esquemas ─────────────────────────────────────────────────
// Los valores por defecto se calculan en cada petición (no al importar
// el módulo) y siempre sobre la fecha de Lima.

export const RangoQuerySchema = z.object({
  desde: fechaIso,
  hasta: fechaIso,
  grado: z.string().max(10).optional(),
  seccion_id: idEntero.optional(),
  ...paginacion,
});

export const AlumnaParamsSchema = z.object({ id: idUuid });

export const AlumnaQuerySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12).default(() => Number(hoyEnLima().slice(5, 7))),
  anio: z.coerce.number().int().min(2000).max(2100).default(() => Number(hoyEnLima().slice(0, 4))),
});

export const RankingQuerySchema = z.object({
  // Sin rango explícito se toman los últimos 30 días: recorrer todo el
  // histórico para ordenar 800 alumnas no es algo que deba poder pedirse
  // por omisión.
  desde: fechaIso.default(() => sumarDias(hoyEnLima(), -30)),
  hasta: fechaIso.default(() => hoyEnLima()),
  limite: z.coerce.number().int().min(1).max(200).default(50),
});

// ── Controladores ────────────────────────────────────────────

export async function reporteRango(req: Request, res: Response): Promise<void> {
  const { desde, hasta, grado, seccion_id, pagina, por_pagina } =
    queryDe<z.infer<typeof RangoQuerySchema>>(req);

  const resultado = await servicio.porRango({
    desde,
    hasta,
    grado,
    seccionId: seccion_id,
    ambito: ambitoDe(req),
    pagina,
    porPagina: por_pagina,
  });

  res.json(resultado);
}

export async function estadisticasAlumna(req: Request, res: Response): Promise<void> {
  const { id } = paramsDe<z.infer<typeof AlumnaParamsSchema>>(req);
  const { mes, anio } = queryDe<z.infer<typeof AlumnaQuerySchema>>(req);

  res.json(await servicio.estadisticasAlumna({ alumnaId: id, mes, anio, ambito: ambitoDe(req) }));
}

export async function rankingTardanzas(req: Request, res: Response): Promise<void> {
  const { desde, hasta, limite } = queryDe<z.infer<typeof RankingQuerySchema>>(req);

  res.json(await servicio.rankingTardanzas({ desde, hasta, limite, ambito: ambitoDe(req) }));
}
