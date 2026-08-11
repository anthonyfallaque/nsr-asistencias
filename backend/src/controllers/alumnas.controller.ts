import { Request, Response } from 'express';
import { z } from 'zod';
import { ambitoDe } from '../middleware/scope.js';
import { bodyDe, idEntero, idUuid, paginacion, paramsDe, queryDe } from '../middleware/validate.js';
import * as servicio from '../services/alumnas.service.js';

// ── Esquemas ─────────────────────────────────────────────────

export const AlumnaSchema = z.object({
  nombres: z.string().trim().min(2).max(100),
  apellidos: z.string().trim().min(2).max(100),
  dni: z.string().regex(/^\d{8}$/, 'El DNI debe tener 8 dígitos').optional(),
  seccion_id: z.number().int().positive(),
  foto_url: z.string().url().max(500).optional(),
});

export const ImportSchema = z
  .array(AlumnaSchema)
  .min(1, 'El lote no puede estar vacío')
  .max(1000, 'El lote no puede superar las 1000 alumnas');

export const ActualizarSchema = AlumnaSchema.partial().refine(
  (campos) => Object.keys(campos).length > 0,
  'Sin campos para actualizar'
);

export const ListarQuerySchema = z.object({
  grado: z.string().max(10).optional(),
  seccion_id: idEntero.optional(),
  buscar: z.string().trim().min(1).max(100).optional(),
  ...paginacion,
});

export const IdParamsSchema = z.object({ id: idUuid });

export const SeccionesQuerySchema = z.object({ grado_id: idEntero.optional() });

// ── Controladores ────────────────────────────────────────────

export async function listar(req: Request, res: Response): Promise<void> {
  const { grado, seccion_id, buscar, pagina, por_pagina } =
    queryDe<z.infer<typeof ListarQuerySchema>>(req);

  const resultado = await servicio.listar({
    grado,
    seccionId: seccion_id,
    buscar,
    ambito: ambitoDe(req),
    pagina,
    porPagina: por_pagina,
  });

  res.json(resultado);
}

export async function crear(req: Request, res: Response): Promise<void> {
  const datos = bodyDe<z.infer<typeof AlumnaSchema>>(req);

  const creada = await servicio.crear({
    ...datos,
    usuarioId: req.usuario!.id,
    ip: req.ip,
  });

  res.status(201).json(creada);
}

export async function obtenerQR(req: Request, res: Response): Promise<void> {
  const { id } = paramsDe<z.infer<typeof IdParamsSchema>>(req);
  res.json(await servicio.obtenerQr(id, ambitoDe(req)));
}

export async function actualizar(req: Request, res: Response): Promise<void> {
  const { id } = paramsDe<z.infer<typeof IdParamsSchema>>(req);
  const campos = bodyDe<z.infer<typeof ActualizarSchema>>(req);

  const alumna = await servicio.actualizar({
    id,
    campos,
    ambito: ambitoDe(req),
    usuarioId: req.usuario!.id,
    ip: req.ip,
  });

  res.json({ ok: true, alumna });
}

export async function desactivar(req: Request, res: Response): Promise<void> {
  const { id } = paramsDe<z.infer<typeof IdParamsSchema>>(req);

  await servicio.desactivar({
    id,
    ambito: ambitoDe(req),
    usuarioId: req.usuario!.id,
    ip: req.ip,
  });

  res.json({ ok: true });
}

export async function listarGrados(_req: Request, res: Response): Promise<void> {
  res.json(await servicio.listarGrados());
}

export async function listarSecciones(req: Request, res: Response): Promise<void> {
  const { grado_id } = queryDe<z.infer<typeof SeccionesQuerySchema>>(req);
  res.json(await servicio.listarSecciones(grado_id, ambitoDe(req)));
}

export async function importarLote(req: Request, res: Response): Promise<void> {
  const alumnas = bodyDe<z.infer<typeof ImportSchema>>(req);

  const resultado = await servicio.importarLote({
    alumnas,
    usuarioId: req.usuario!.id,
    ip: req.ip,
  });

  res.status(resultado.fallidas > 0 ? 207 : 200).json(resultado);
}
