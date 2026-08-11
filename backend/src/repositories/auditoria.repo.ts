import { Ejecutor, afectadas, pool } from '../db.js';

export type AccionAuditada =
  | 'login'
  | 'cambiar_password'
  | 'asistencia_justificar'
  | 'asistencia_marcar_manual'
  | 'asistencia_sync_offline'
  | 'alumna_crear'
  | 'alumna_actualizar'
  | 'alumna_desactivar'
  | 'alumna_importar_lote'
  | 'usuario_crear'
  | 'usuario_actualizar';

export interface RegistroAuditoria {
  usuarioId: string | null;
  accion: AccionAuditada;
  ip?: string | null;
  /** Estado previo y posterior del recurso tocado. */
  antes?: unknown;
  despues?: unknown;
  /** Contexto adicional (identificadores, totales del lote...). */
  contexto?: Record<string, unknown>;
}

/**
 * Deja constancia de una mutación.
 *
 * Se llama SIEMPRE con el mismo ejecutor que la mutación: si la
 * transacción se revierte, la línea de auditoría desaparece con ella y
 * no queda registro de algo que nunca pasó.
 */
export async function registrar(
  ex: Ejecutor = pool,
  registro: RegistroAuditoria
): Promise<void> {
  const detalle = {
    ...(registro.contexto ?? {}),
    antes: registro.antes ?? null,
    despues: registro.despues ?? null,
  };

  await afectadas(
    ex,
    `INSERT INTO auditoria (usuario_id, accion, detalle, ip)
     VALUES ($1, $2, $3::jsonb, $4)`,
    [registro.usuarioId, registro.accion, JSON.stringify(detalle), registro.ip ?? null]
  );
}
