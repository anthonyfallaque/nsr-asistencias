import { Request, Response, NextFunction } from 'express';
import type { Rol } from '../types/index.js';

export function requireRol(...roles: Rol[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    if (!roles.includes(req.usuario.rol)) {
      res.status(403).json({ error: 'Sin permiso para esta acción' });
      return;
    }
    next();
  };
}
