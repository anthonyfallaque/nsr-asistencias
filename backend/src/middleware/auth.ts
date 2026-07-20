import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload, Usuario } from '../types/index.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token requerido' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.usuario = {
      id: payload.sub,
      email: payload.email,
      nombre: '',
      rol: payload.rol,
      activo: true,
    } satisfies Usuario;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}
