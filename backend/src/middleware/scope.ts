import { NextFunction, Request, Response } from 'express';
import { errNoAutenticado } from '../errors/AppError.js';
import * as seccionesRepo from '../repositories/secciones.repo.js';
import type { AmbitoUsuario } from '../types/index.js';

/**
 * Resuelve qué secciones puede ver y tocar el usuario.
 *
 * El resultado NO se comprueba con un `if` en el controlador: viaja
 * hasta el WHERE de cada consulta (ver `filtroAmbito`). Así una tutora
 * no puede leer el DNI, la foto ni el historial de las alumnas de otras
 * secciones, ni modificar su asistencia cambiando un id en la petición.
 */
export async function scopeSecciones(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.usuario) throw errNoAutenticado();

  req.ambito = await resolverAmbito(req.usuario.rol, req.usuario.id);
  next();
}

async function resolverAmbito(rol: string, usuarioId: string): Promise<AmbitoUsuario> {
  switch (rol) {
    case 'admin':
    case 'directora':
      return { secciones: null }; // todo el colegio

    case 'tutora':
      return { secciones: await seccionesRepo.idsPorTutora(usuarioId) };

    case 'auxiliar':
      // TODO: el colegio aún no ha definido si las auxiliares se reparten
      // por grado o por turno. Hasta entonces ven todo el colegio; cuando
      // se decida, basta con devolver aquí la lista que corresponda.
      return { secciones: null };

    case 'portero':
      // Sólo escanea; no consulta listados por sección.
      return { secciones: [] };

    default:
      return { secciones: [] };
  }
}

/**
 * Ámbito para pasar como parámetro a una consulta.
 * `null` significa "sin restricción" y el SQL lo trata con
 * `($n::int[] IS NULL OR columna = ANY($n))`.
 *
 * Aquí conviven dos valores que parecen lo mismo y significan lo contrario:
 *
 *   - `req.ambito` ausente  → el middleware no corrió. Se deniega todo (`[]`).
 *   - `req.ambito.secciones` a `null` → corrió y no hay restricción (`null`).
 *
 * Por eso NO puede escribirse `req.ambito?.secciones ?? []`: `??` también
 * dispara con `null`, de modo que el caso "sin restricción" se convertiría
 * en "sin acceso" y admin y directora no verían una sola fila en todo el
 * sistema. La comprobación tiene que ser sobre el objeto, no sobre el campo.
 */
export function ambitoDe(req: Request): number[] | null {
  return req.ambito ? req.ambito.secciones : [];
}

/**
 * Fragmento SQL de filtro por ámbito.
 *
 *   filtroAmbito('al.seccion_id', 3)  →  "($3::int[] IS NULL OR al.seccion_id = ANY($3))"
 */
export function filtroAmbito(columna: string, indiceParam: number): string {
  return `($${indiceParam}::int[] IS NULL OR ${columna} = ANY($${indiceParam}))`;
}
