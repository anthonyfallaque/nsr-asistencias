import { Ejecutor, fila, pool } from '../db.js';

export interface ConfiguracionHorario {
  id: number;
  hora_entrada: string;
  minutos_tolerancia: number;
}

/**
 * Configuración de horario vigente.
 *
 * Un índice único parcial garantiza que sólo puede haber una fila activa,
 * así que el ORDER BY es defensa en profundidad, no la solución: antes
 * `WHERE activo = true LIMIT 1` sin orden devolvía una fila indeterminada
 * y el corte de tardanza podía cambiar entre peticiones.
 */
export async function obtenerActiva(ex: Ejecutor = pool): Promise<ConfiguracionHorario | null> {
  return fila<ConfiguracionHorario>(
    ex,
    `SELECT id, hora_entrada::text AS hora_entrada, minutos_tolerancia
       FROM configuracion_horario
      WHERE activo = true
      ORDER BY id
      LIMIT 1`
  );
}
