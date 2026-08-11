import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError, errNoAutenticado } from '../errors/AppError.js';
import * as usuariosRepo from '../repositories/usuarios.repo.js';
import type { JwtPayload, Usuario } from '../types/index.js';

/**
 * Caché de usuarios verificados.
 *
 * El token dura 8 h y antes se reconstruía `req.usuario` sólo con su
 * payload (con `activo: true` fijo), así que desactivar a alguien no
 * surtía efecto hasta que expirase. Ahora se consulta la base de datos,
 * con una caché corta para no añadir una consulta a cada petición.
 */
const TTL_MS = 45_000;

interface Entrada {
  usuario: Usuario;
  expira: number;
}

const cache = new Map<string, Entrada>();

/** Invalida la caché de un usuario tras cambiarle rol, estado o contraseña. */
export function invalidarCacheUsuario(id: string): void {
  cache.delete(id);
}

export function limpiarCacheUsuarios(): void {
  cache.clear();
}

async function resolverUsuario(id: string): Promise<Usuario | null> {
  const ahora = Date.now();
  const enCache = cache.get(id);
  if (enCache && enCache.expira > ahora) return enCache.usuario;

  const usuario = await usuariosRepo.buscarPorId(id);
  if (!usuario) {
    cache.delete(id);
    return null;
  }

  cache.set(id, { usuario, expira: ahora + TTL_MS });

  // Poda perezosa: sin esto la caché crecería sin límite.
  if (cache.size > 500) {
    for (const [clave, entrada] of cache) {
      if (entrada.expira <= ahora) cache.delete(clave);
    }
  }

  return usuario;
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw errNoAutenticado('Token requerido');
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(header.slice(7), env.JWT_SECRET) as JwtPayload;
  } catch {
    throw errNoAutenticado('Token inválido o expirado');
  }

  const usuario = await resolverUsuario(payload.sub);
  if (!usuario || !usuario.activo) {
    // Mismo mensaje para "borrado" y "desactivado": no hace falta decir cuál.
    throw errNoAutenticado('La sesión ya no es válida. Vuelve a iniciar sesión.');
  }

  req.usuario = usuario;
  next();
}

/**
 * Bloquea el acceso mientras la cuenta arrastre la contraseña inicial.
 *
 * Sin esto, `debe_cambiar_password` es un aviso que se puede ignorar
 * indefinidamente — y las credenciales del seed están publicadas en el
 * repositorio, así que una cuenta sin cambiar es una cuenta cuya
 * contraseña conoce cualquiera que haya visto el código.
 *
 * Se aplica a los routers de datos pero NO a `/api/auth`: el usuario tiene
 * que poder llamar a `cambiar-password` para salir de este estado.
 *
 * El código `PASSWORD_INICIAL` es estable para que el cliente pueda abrir
 * el diálogo de cambio automáticamente en vez de mostrar un error suelto.
 */
export function exigirPasswordVigente(req: Request, _res: Response, next: NextFunction): void {
  if (req.usuario?.debe_cambiar_password) {
    throw new AppError(
      403,
      'PASSWORD_INICIAL',
      'Debes cambiar tu contraseña inicial antes de continuar.'
    );
  }
  next();
}
