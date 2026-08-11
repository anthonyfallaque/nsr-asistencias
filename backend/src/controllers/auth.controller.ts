import { Request, Response } from 'express';
import { z } from 'zod';
import { bodyDe } from '../middleware/validate.js';
import * as servicio from '../services/auth.service.js';

// ── Esquemas ─────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(200),
});

/**
 * Mínimo de 10 caracteres: son cuentas de personal del colegio con
 * acceso a datos de menores, no un foro.
 */
export const CambiarPasswordSchema = z.object({
  actual: z.string().min(1).max(200),
  nueva: z
    .string()
    .min(10, 'La nueva contraseña debe tener al menos 10 caracteres')
    .max(200)
    .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), 'Debe combinar letras y números'),
});

// ── Controladores ────────────────────────────────────────────

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = bodyDe<z.infer<typeof LoginSchema>>(req);
  res.json(await servicio.login({ email, password, ip: req.ip }));
}

export async function me(req: Request, res: Response): Promise<void> {
  const usuario = await servicio.perfil(req.usuario!.id);

  res.json({
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol,
    debe_cambiar_password: usuario.debe_cambiar_password,
  });
}

export async function cambiarPassword(req: Request, res: Response): Promise<void> {
  const { actual, nueva } = bodyDe<z.infer<typeof CambiarPasswordSchema>>(req);

  await servicio.cambiarPassword({
    usuarioId: req.usuario!.id,
    actual,
    nueva,
    ip: req.ip,
  });

  res.json({ ok: true, mensaje: 'Contraseña actualizada. Vuelve a iniciar sesión.' });
}
