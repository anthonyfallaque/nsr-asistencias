import { NextFunction, Request, Response } from 'express';
import { ZodTypeAny, z } from 'zod';
import { AppError } from '../errors/AppError.js';

interface Esquemas {
  params?: ZodTypeAny;
  query?: ZodTypeAny;
  body?: ZodTypeAny;
}

/**
 * Valida params, query y body antes de llegar al controlador.
 *
 * Hasta ahora sólo se validaba el cuerpo: cualquier `?fecha=xxx` o
 * `:id` no-UUID llegaba tal cual a Postgres y provocaba un 500.
 *
 * Los valores validados sustituyen a los originales, así que el
 * controlador recibe tipos ya convertidos (números, fechas, booleanos).
 */
export function validate(esquemas: Esquemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (esquemas.params) {
      const r = esquemas.params.safeParse(req.params);
      if (!r.success) return next(errorDeZod('params', r.error));
      reemplazar(req, 'params', r.data);
    }

    if (esquemas.query) {
      const r = esquemas.query.safeParse(req.query);
      if (!r.success) return next(errorDeZod('query', r.error));
      reemplazar(req, 'query', r.data);
    }

    if (esquemas.body) {
      const r = esquemas.body.safeParse(req.body);
      if (!r.success) return next(errorDeZod('body', r.error));
      req.body = r.data;
    }

    next();
  };
}

function errorDeZod(origen: 'params' | 'query' | 'body', error: z.ZodError): AppError {
  const donde = { params: 'la ruta', query: 'los parámetros de consulta', body: 'el cuerpo' }[origen];
  return new AppError(400, 'DATOS_INVALIDOS', `Datos inválidos en ${donde}.`, error.flatten());
}

/**
 * `req.query` es un getter en algunas versiones de Express: asignarlo
 * directamente puede lanzar en modo estricto.
 */
function reemplazar(req: Request, propiedad: 'params' | 'query', valor: unknown): void {
  Object.defineProperty(req, propiedad, {
    value: valor,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

// ── Accesores tipados ────────────────────────────────────────
// Tras `validate` los valores ya tienen el tipo del esquema, pero
// Express los sigue declarando como string. Estos ayudantes evitan
// repetir el casting en cada controlador.

export const paramsDe = <T>(req: Request): T => req.params as unknown as T;
export const queryDe = <T>(req: Request): T => req.query as unknown as T;
export const bodyDe = <T>(req: Request): T => req.body as T;

// ── Esquemas reutilizables ───────────────────────────────────

export const idUuid = z.string().uuid('Identificador inválido');

export const idEntero = z.coerce
  .number({ invalid_type_error: 'Identificador inválido' })
  .int('Identificador inválido')
  .positive('Identificador inválido');

/** Fecha en formato YYYY-MM-DD, validada como fecha real del calendario. */
export const fechaIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato YYYY-MM-DD')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'La fecha no existe en el calendario');

export const paginacion = {
  pagina: z.coerce.number().int().min(1).default(1),
  por_pagina: z.coerce.number().int().min(1).max(500).default(100),
};
