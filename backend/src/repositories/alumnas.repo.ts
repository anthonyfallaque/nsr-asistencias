import { Ejecutor, afectadas, fila, filas, pool } from '../db.js';
import { filtroAmbito } from '../middleware/scope.js';
import { JOIN_SECCION_ACTUAL } from './sql.js';

export interface AlumnaListada {
  id: string;
  nombres: string;
  apellidos: string;
  dni: string | null;
  foto_url: string | null;
  activa: boolean;
  grado: string;
  seccion: string;
  seccion_id: number;
}

export interface FiltrosAlumnas {
  grado?: string;
  seccionId?: number;
  buscar?: string;
  ambito: number[] | null;
  limite: number;
  desplazamiento: number;
}

export async function listar(
  filtros: FiltrosAlumnas,
  ex: Ejecutor = pool
): Promise<{ filas: AlumnaListada[]; total: number }> {
  const params: unknown[] = [filtros.ambito];
  let condiciones = '';

  if (filtros.grado) {
    params.push(filtros.grado);
    condiciones += ` AND g.nombre = $${params.length}`;
  }
  if (filtros.seccionId !== undefined) {
    params.push(filtros.seccionId);
    condiciones += ` AND al.seccion_id = $${params.length}`;
  }
  if (filtros.buscar) {
    params.push(`%${filtros.buscar}%`);
    const p = `$${params.length}`;
    condiciones += ` AND (al.nombres ILIKE ${p} OR al.apellidos ILIKE ${p} OR al.dni ILIKE ${p})`;
  }

  const base = `
       FROM alumnas al
       ${JOIN_SECCION_ACTUAL}
      WHERE al.activa = true
        AND ${filtroAmbito('al.seccion_id', 1)}${condiciones}`;

  const totalRow = await fila<{ total: string }>(
    ex,
    `SELECT COUNT(*)::text AS total ${base}`,
    params
  );

  params.push(filtros.limite, filtros.desplazamiento);

  const rows = await filas<AlumnaListada>(
    ex,
    `SELECT al.id, al.nombres, al.apellidos, al.dni, al.foto_url, al.activa,
            g.nombre AS grado, s.nombre AS seccion, al.seccion_id
       ${base}
      ORDER BY al.apellidos, al.nombres
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { filas: rows, total: Number(totalRow?.total ?? 0) };
}

export interface AlumnaDetalle {
  id: string;
  nombres: string;
  apellidos: string;
  dni: string | null;
  foto_url: string | null;
  seccion_id: number;
  activa: boolean;
}

/** Devuelve null también cuando la alumna está fuera del ámbito. */
export async function buscarPorId(
  id: string,
  ambito: number[] | null,
  ex: Ejecutor = pool
): Promise<AlumnaDetalle | null> {
  return fila<AlumnaDetalle>(
    ex,
    `SELECT al.id, al.nombres, al.apellidos, al.dni, al.foto_url,
            al.seccion_id, al.activa
       FROM alumnas al
      WHERE al.id = $1 AND ${filtroAmbito('al.seccion_id', 2)}`,
    [id, ambito]
  );
}

export interface DatosQr {
  qr_token: string;
  nombres: string;
  apellidos: string;
  grado: string;
  seccion: string;
}

export async function datosQr(
  id: string,
  ambito: number[] | null,
  ex: Ejecutor = pool
): Promise<DatosQr | null> {
  return fila<DatosQr>(
    ex,
    `SELECT al.qr_token, al.nombres, al.apellidos, g.nombre AS grado, s.nombre AS seccion
       FROM alumnas al
       ${JOIN_SECCION_ACTUAL}
      WHERE al.id = $1 AND al.activa = true
        AND ${filtroAmbito('al.seccion_id', 2)}`,
    [id, ambito]
  );
}

export interface NuevaAlumna {
  nombres: string;
  apellidos: string;
  dni?: string | null;
  seccionId: number;
  fotoUrl?: string | null;
  qrToken: string;
}

export async function crear(
  ex: Ejecutor,
  datos: NuevaAlumna
): Promise<{ id: string; qr_token: string } | null> {
  return fila<{ id: string; qr_token: string }>(
    ex,
    `INSERT INTO alumnas (nombres, apellidos, dni, seccion_id, qr_token, foto_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, qr_token`,
    [
      datos.nombres,
      datos.apellidos,
      datos.dni ?? null,
      datos.seccionId,
      datos.qrToken,
      datos.fotoUrl ?? null,
    ]
  );
}

/**
 * Alta idempotente para la importación masiva: si el DNI ya existe no
 * hace nada y devuelve null, sin abortar el lote.
 */
export async function crearSiNoExiste(
  ex: Ejecutor,
  datos: NuevaAlumna
): Promise<{ id: string } | null> {
  return fila<{ id: string }>(
    ex,
    `INSERT INTO alumnas (nombres, apellidos, dni, seccion_id, qr_token, foto_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (dni) DO NOTHING
     RETURNING id`,
    [
      datos.nombres,
      datos.apellidos,
      datos.dni ?? null,
      datos.seccionId,
      datos.qrToken,
      datos.fotoUrl ?? null,
    ]
  );
}

export interface CamposAlumna {
  nombres?: string;
  apellidos?: string;
  dni?: string;
  seccion_id?: number;
  foto_url?: string;
}

/**
 * Actualiza sólo si la alumna cae dentro del ámbito del usuario.
 * Devuelve null cuando no existe o no le corresponde: el controlador
 * responde 404 en ambos casos para no revelar cuál de los dos es.
 */
export async function actualizar(
  ex: Ejecutor,
  id: string,
  campos: CamposAlumna,
  ambito: number[] | null
): Promise<AlumnaDetalle | null> {
  const sets: string[] = [];
  const params: unknown[] = [id, ambito];

  const push = (columna: string, valor: unknown): void => {
    params.push(valor);
    sets.push(`${columna} = $${params.length}`);
  };

  if (campos.nombres !== undefined) push('nombres', campos.nombres);
  if (campos.apellidos !== undefined) push('apellidos', campos.apellidos);
  if (campos.dni !== undefined) push('dni', campos.dni);
  if (campos.seccion_id !== undefined) push('seccion_id', campos.seccion_id);
  if (campos.foto_url !== undefined) push('foto_url', campos.foto_url);

  if (sets.length === 0) return buscarPorId(id, ambito, ex);

  return fila<AlumnaDetalle>(
    ex,
    `UPDATE alumnas SET ${sets.join(', ')}
      WHERE id = $1 AND activa = true
        AND ${filtroAmbito('seccion_id', 2)}
     RETURNING id, nombres, apellidos, dni, foto_url, seccion_id, activa`,
    params
  );
}

/** Devuelve 0 si no existía o quedaba fuera del ámbito. */
export async function desactivar(
  ex: Ejecutor,
  id: string,
  ambito: number[] | null
): Promise<number> {
  return afectadas(
    ex,
    `UPDATE alumnas SET activa = false
      WHERE id = $1 AND activa = true
        AND ${filtroAmbito('seccion_id', 2)}`,
    [id, ambito]
  );
}

/** Comprueba que la sección exista antes de dar de alta. */
export async function existeSeccion(ex: Ejecutor, seccionId: number): Promise<boolean> {
  const row = await fila<{ id: number }>(ex, `SELECT id FROM secciones WHERE id = $1`, [
    seccionId,
  ]);
  return row !== null;
}
