/**
 * Error de dominio con contrato estable hacia el cliente.
 *
 * El manejador global traduce cualquier AppError a
 * `{ codigo, mensaje, detalles? }` con el status indicado.
 * Todo lo que no sea AppError se responde como 500 genérico y el
 * detalle real (con stack) queda en el log del servidor.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensaje: string,
    public readonly detalles?: unknown
  ) {
    super(mensaje);
    this.name = 'AppError';
    Error.captureStackTrace?.(this, AppError);
  }
}

// ── Constructores habituales ─────────────────────────────────

export const errDatosInvalidos = (mensaje = 'Datos inválidos', detalles?: unknown) =>
  new AppError(400, 'DATOS_INVALIDOS', mensaje, detalles);

export const errNoAutenticado = (mensaje = 'No autenticado') =>
  new AppError(401, 'NO_AUTENTICADO', mensaje);

export const errSinPermiso = (mensaje = 'Sin permiso para esta acción') =>
  new AppError(403, 'SIN_PERMISO', mensaje);

/**
 * 404 también cuando el recurso existe pero está fuera del ámbito del
 * usuario: un 403 confirmaría que la alumna existe, y eso ya es una fuga.
 */
export const errNoEncontrado = (mensaje = 'Recurso no encontrado') =>
  new AppError(404, 'NO_ENCONTRADO', mensaje);

export const errConflicto = (mensaje = 'El recurso ya existe', detalles?: unknown) =>
  new AppError(409, 'CONFLICTO', mensaje, detalles);

export const errNoProcesable = (mensaje: string, detalles?: unknown) =>
  new AppError(422, 'NO_PROCESABLE', mensaje, detalles);

export const errConfiguracion = (mensaje: string) =>
  new AppError(503, 'CONFIGURACION_INCOMPLETA', mensaje);
