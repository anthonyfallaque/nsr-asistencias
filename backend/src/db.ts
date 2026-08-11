import { Pool, PoolClient } from 'pg';
import { env } from './config/env.js';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl:
    env.DATABASE_URL.includes('supabase') || env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
});

pool.on('error', (err) => {
  console.error('[DB] Error inesperado en el pool:', err);
});

/**
 * Quien ejecuta una consulta: el pool (consulta suelta) o un cliente
 * dentro de una transacción. Los repositorios lo reciben para poder
 * participar en la transacción del servicio que los llama.
 */
export type Ejecutor = Pool | PoolClient;

/** Ejecuta y devuelve las filas. */
export async function filas<T = Record<string, unknown>>(
  ex: Ejecutor,
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const resultado = await (ex as Pool).query(text, params as never[]);
  return resultado.rows as T[];
}

/** Ejecuta y devuelve la primera fila, o null. */
export async function fila<T = Record<string, unknown>>(
  ex: Ejecutor,
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await filas<T>(ex, text, params);
  return rows[0] ?? null;
}

/** Ejecuta y devuelve el número de filas afectadas. */
export async function afectadas(
  ex: Ejecutor,
  text: string,
  params: unknown[] = []
): Promise<number> {
  const resultado = await (ex as Pool).query(text, params as never[]);
  return resultado.rowCount ?? 0;
}

// ── Atajos sobre el pool para consultas sueltas ───────────────

export const query = <T = Record<string, unknown>>(text: string, params?: unknown[]) =>
  filas<T>(pool, text, params);

export const queryOne = <T = Record<string, unknown>>(text: string, params?: unknown[]) =>
  fila<T>(pool, text, params);

/**
 * Ejecuta `fn` dentro de una transacción sobre un único cliente.
 * Confirma al terminar y revierte ante cualquier excepción.
 *
 *   await withTx(async (cx) => {
 *     await repo.actualizar(cx, ...);
 *     await auditoria.registrar(cx, ...);   // misma transacción
 *   });
 *
 * El helper anterior pedía y soltaba una conexión por consulta, lo que
 * hacía imposible agrupar varias en una transacción.
 */
export async function withTx<T>(fn: (cx: PoolClient) => Promise<T>): Promise<T> {
  const cx = await pool.connect();
  try {
    await cx.query('BEGIN');
    const resultado = await fn(cx);
    await cx.query('COMMIT');
    return resultado;
  } catch (err) {
    try {
      await cx.query('ROLLBACK');
    } catch (errRollback) {
      console.error('[DB] Fallo al revertir la transacción:', errRollback);
    }
    throw err;
  } finally {
    cx.release();
  }
}

/**
 * Aísla un paso dentro de una transacción ya abierta: si falla, revierte
 * sólo ese paso y la transacción sigue viva. Lo usan los procesos por
 * lotes, donde un elemento malformado no debe tumbar el lote entero.
 */
export async function conSavepoint<T>(
  cx: PoolClient,
  nombre: string,
  fn: () => Promise<T>
): Promise<T> {
  // El nombre va interpolado (no admite parámetros): sólo identificadores.
  const punto = nombre.replace(/[^a-zA-Z0-9_]/g, '') || 'sp';

  await cx.query(`SAVEPOINT ${punto}`);
  try {
    const resultado = await fn();
    await cx.query(`RELEASE SAVEPOINT ${punto}`);
    return resultado;
  } catch (err) {
    await cx.query(`ROLLBACK TO SAVEPOINT ${punto}`);
    throw err;
  }
}
