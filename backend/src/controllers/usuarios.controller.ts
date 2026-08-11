import { Request, Response } from 'express';
import { z } from 'zod';
import { bodyDe, idUuid, paramsDe } from '../middleware/validate.js';
import * as servicio from '../services/usuarios.service.js';
import { ROLES } from '../types/index.js';

// ── Esquemas ─────────────────────────────────────────────────

const rolSchema = z.enum(ROLES as unknown as [string, ...string[]]);

export const CrearUsuarioSchema = z.object({
  email: z.string().trim().email().max(255),
  nombre: z.string().trim().min(3).max(100),
  rol: rolSchema,
});

export const ActualizarUsuarioSchema = z
  .object({
    nombre: z.string().trim().min(3).max(100).optional(),
    rol: rolSchema.optional(),
    activo: z.boolean().optional(),
    restablecer_password: z.boolean().optional(),
  })
  .refine((campos) => Object.keys(campos).length > 0, 'Sin campos para actualizar');

export const IdParamsSchema = z.object({ id: idUuid });

// ── Controladores ────────────────────────────────────────────

export async function listar(_req: Request, res: Response): Promise<void> {
  res.json(await servicio.listar());
}

export async function crear(req: Request, res: Response): Promise<void> {
  const datos = bodyDe<z.infer<typeof CrearUsuarioSchema>>(req);

  const { usuario, password_provisional } = await servicio.crear({
    email: datos.email,
    nombre: datos.nombre,
    rol: datos.rol as never,
    creadoPor: req.usuario!.id,
    ip: req.ip,
  });

  // La contraseña provisional se devuelve UNA sola vez, al crear.
  // No se guarda en claro ni se puede volver a consultar.
  res.status(201).json({ usuario, password_provisional });
}

export async function actualizar(req: Request, res: Response): Promise<void> {
  const { id } = paramsDe<z.infer<typeof IdParamsSchema>>(req);
  const campos = bodyDe<z.infer<typeof ActualizarUsuarioSchema>>(req);

  const { usuario, password_provisional } = await servicio.actualizar({
    id,
    campos: campos as never,
    actualizadoPor: req.usuario!.id,
    ip: req.ip,
  });

  res.json({ ok: true, usuario, ...(password_provisional ? { password_provisional } : {}) });
}
