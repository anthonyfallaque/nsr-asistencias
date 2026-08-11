import { NextFunction, Request, Response } from 'express';
import { errNoAutenticado, errSinPermiso } from '../errors/AppError.js';
import type { Rol } from '../types/index.js';

/**
 * Control de acceso por rol: quién puede llamar a la ruta.
 *
 * Es independiente del ámbito (`scopeSecciones`), que decide sobre QUÉ
 * filas puede operar. Una tutora pasa este filtro para consultar
 * asistencias, pero el ámbito la limita a sus propias secciones.
 */
export function requireRol(...roles: Rol[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.usuario) throw errNoAutenticado();
    if (!roles.includes(req.usuario.rol)) throw errSinPermiso();
    next();
  };
}
