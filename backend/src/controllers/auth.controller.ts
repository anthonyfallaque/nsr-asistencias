import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { queryOne, query } from '../db.js';
import type { JwtPayload, Rol } from '../types/index.js';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Email o contraseña inválidos' });
      return;
    }

    const { email, password } = parsed.data;

    const row = await queryOne<{
      id: string; email: string; nombre: string;
      password_hash: string; rol: Rol; activo: boolean;
    }>(
      `SELECT u.id, u.email, u.nombre, u.password_hash, r.nombre AS rol, u.activo
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE u.email = $1`,
      [email]
    );

    if (!row || !row.activo) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    const payload: JwtPayload = { sub: row.id, email: row.email, rol: row.rol };
    const token = jwt.sign(payload as object, process.env.JWT_SECRET as string, {
      expiresIn: '8h',
    });

    await query(
      `INSERT INTO auditoria (usuario_id, accion, ip) VALUES ($1, 'login', $2)`,
      [row.id, req.ip]
    );

    res.json({
      token,
      usuario: { id: row.id, email: row.email, nombre: row.nombre, rol: row.rol },
    });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

export async function me(req: Request, res: Response): Promise<void> {
  try {
    const row = await queryOne<{ id: string; email: string; nombre: string; rol: string }>(
      `SELECT u.id, u.email, u.nombre, r.nombre AS rol
       FROM usuarios u JOIN roles r ON r.id = u.rol_id
       WHERE u.id = $1 AND u.activo = true`,
      [req.usuario!.id]
    );

    if (!row) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
    res.json(row);
  } catch (err) {
    console.error('[me]', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}
