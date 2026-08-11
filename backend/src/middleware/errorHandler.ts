import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError.js';
import { env } from '../config/env.js';

/** Error de PostgreSQL tal y como lo emite `pg`. */
interface ErrorPg extends Error {
  code?: string;
  detail?: string;
  constraint?: string;
  table?: string;
  column?: string;
}

interface RespuestaError {
  status: number;
  codigo: string;
  mensaje: string;
  detalles?: unknown;
}

/**
 * Traduce códigos SQLSTATE a respuestas HTTP con mensaje en castellano.
 * Nunca se devuelve el texto crudo de Postgres: filtraría nombres de
 * tablas, columnas y restricciones.
 */
function traducirErrorPg(err: ErrorPg): RespuestaError | null {
  switch (err.code) {
    case '23505': // unique_violation
      return {
        status: 409,
        codigo: 'DUPLICADO',
        mensaje: mensajeDuplicado(err.constraint),
      };
    case '23503': // foreign_key_violation
      return {
        status: 422,
        codigo: 'REFERENCIA_INVALIDA',
        mensaje: 'Alguno de los datos referenciados no existe.',
      };
    case '23502': // not_null_violation
      return {
        status: 422,
        codigo: 'CAMPO_REQUERIDO',
        mensaje: 'Falta un campo obligatorio.',
      };
    case '23514': // check_violation
      return {
        status: 422,
        codigo: 'RESTRICCION_INCUMPLIDA',
        mensaje: 'Los datos no cumplen una restricción del sistema.',
      };
    case '22P02': // invalid_text_representation
    case '22007': // invalid_datetime_format
    case '22008': // datetime_field_overflow
      return {
        status: 400,
        codigo: 'FORMATO_INVALIDO',
        mensaje: 'Alguno de los valores enviados tiene un formato inválido.',
      };
    case '57014': // query_canceled
      return {
        status: 504,
        codigo: 'CONSULTA_CANCELADA',
        mensaje: 'La consulta tardó demasiado. Acota el rango e inténtalo de nuevo.',
      };
    case 'ECONNREFUSED':
    case 'ETIMEDOUT':
    case '08006': // connection_failure
    case '08003': // connection_does_not_exist
      return {
        status: 503,
        codigo: 'BD_NO_DISPONIBLE',
        mensaje: 'La base de datos no está disponible. Inténtalo en unos segundos.',
      };
    default:
      return null;
  }
}

function mensajeDuplicado(constraint?: string): string {
  if (!constraint) return 'Ya existe un registro con esos datos.';
  if (constraint.includes('dni')) return 'Ya existe una alumna con ese DNI.';
  if (constraint.includes('email')) return 'Ya existe un usuario con ese email.';
  if (constraint.includes('alumna_id')) return 'Ya existe un registro de asistencia para esa alumna y fecha.';
  if (constraint.includes('qr_token')) return 'Ese código QR ya está asignado.';
  return 'Ya existe un registro con esos datos.';
}

function clasificar(err: unknown): RespuestaError {
  if (err instanceof AppError) {
    return { status: err.status, codigo: err.codigo, mensaje: err.message, detalles: err.detalles };
  }

  if (err instanceof ZodError) {
    return {
      status: 400,
      codigo: 'DATOS_INVALIDOS',
      mensaje: 'Datos inválidos.',
      detalles: err.flatten(),
    };
  }

  if (err instanceof Error) {
    const traducido = traducirErrorPg(err as ErrorPg);
    if (traducido) return traducido;

    // JSON malformado en el cuerpo (body-parser)
    if ('type' in err && (err as { type?: string }).type === 'entity.parse.failed') {
      return { status: 400, codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo de la petición no es JSON válido.' };
    }
    if ('type' in err && (err as { type?: string }).type === 'entity.too.large') {
      return { status: 413, codigo: 'CUERPO_DEMASIADO_GRANDE', mensaje: 'El cuerpo de la petición es demasiado grande.' };
    }
  }

  return { status: 500, codigo: 'ERROR_INTERNO', mensaje: 'Error interno del servidor.' };
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Si la respuesta ya salió, sólo Express puede cerrar la conexión.
  if (res.headersSent) {
    console.error('[ERROR] Tras enviar la respuesta:', err);
    next(err);
    return;
  }

  const { status, codigo, mensaje, detalles } = clasificar(err);
  const contexto = `${req.method} ${req.originalUrl}`;
  const usuario = req.usuario ? `usuario=${req.usuario.id}` : 'anónimo';

  // El stack se registra siempre: es lo único que permite diagnosticar
  // un 500 después de que ocurra.
  if (status >= 500) {
    console.error(`[ERROR ${status}] ${contexto} (${usuario}) ${codigo}:`, err);
  } else {
    const detalle = err instanceof Error ? err.message : String(err);
    console.warn(`[AVISO ${status}] ${contexto} (${usuario}) ${codigo}: ${detalle}`);
  }

  res.status(status).json({
    codigo,
    mensaje,
    ...(detalles !== undefined ? { detalles } : {}),
    // Alias de compatibilidad: el cliente actual lee `error`.
    error: mensaje,
    ...(env.NODE_ENV !== 'production' && status >= 500 && err instanceof Error
      ? { debug: err.message }
      : {}),
  });
}

/** 404 uniforme para rutas inexistentes. */
export function noEncontradoHandler(_req: Request, res: Response): void {
  res.status(404).json({
    codigo: 'RUTA_NO_ENCONTRADA',
    mensaje: 'Ruta no encontrada.',
    error: 'Ruta no encontrada.',
  });
}
