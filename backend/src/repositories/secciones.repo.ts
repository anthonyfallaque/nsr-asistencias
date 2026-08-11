import { Ejecutor, filas, pool } from '../db.js';
import { filtroAmbito } from '../middleware/scope.js';

export async function idsPorTutora(tutoraId: string, ex: Ejecutor = pool): Promise<number[]> {
  const rows = await filas<{ id: number }>(
    ex,
    `SELECT id FROM secciones WHERE tutora_id = $1 ORDER BY id`,
    [tutoraId]
  );
  return rows.map((r) => r.id);
}

export async function listarGrados(ex: Ejecutor = pool) {
  return filas(ex, `SELECT id, nombre FROM grados ORDER BY id`);
}

export interface SeccionListada {
  id: number;
  nombre: string;
  grado: string;
  grado_id: number;
  tutora: string | null;
}

export async function listarSecciones(
  opciones: { gradoId?: number; ambito: number[] | null },
  ex: Ejecutor = pool
): Promise<SeccionListada[]> {
  const params: unknown[] = [opciones.ambito];
  let filtroGrado = '';

  if (opciones.gradoId !== undefined) {
    params.push(opciones.gradoId);
    filtroGrado = ` AND s.grado_id = $${params.length}`;
  }

  return filas<SeccionListada>(
    ex,
    `SELECT s.id, s.nombre, g.nombre AS grado, g.id AS grado_id, u.nombre AS tutora
       FROM secciones s
       JOIN grados g ON g.id = s.grado_id
       LEFT JOIN usuarios u ON u.id = s.tutora_id
      WHERE ${filtroAmbito('s.id', 1)}${filtroGrado}
      ORDER BY g.id, s.nombre`,
    params
  );
}
