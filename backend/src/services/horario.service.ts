import { Ejecutor, pool } from '../db.js';
import { errConfiguracion } from '../errors/AppError.js';
import * as horarioRepo from '../repositories/horario.repo.js';
import { ZONA_HORARIA } from '../config/env.js';

/**
 * Fecha de hoy en la zona horaria del colegio, en formato YYYY-MM-DD.
 *
 * `toISOString().slice(0,10)` daba la fecha UTC: con el proceso en UTC,
 * a partir de las 19:00 de Lima "hoy" ya era el día siguiente.
 */
export function hoyEnLima(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Configuración de horario vigente.
 *
 * Falla de forma explícita si no hay ninguna activa. Antes se devolvía
 * `null` en silencio y el `if (config)` de los controladores dejaba a
 * TODAS las alumnas como puntuales sin que nadie se enterase.
 */
export async function configuracionVigente(ex: Ejecutor = pool) {
  const config = await horarioRepo.obtenerActiva(ex);

  if (!config) {
    throw errConfiguracion(
      'No hay configuración de horario activa. Registra la hora de entrada ' +
        'en configuracion_horario antes de registrar asistencias.'
    );
  }

  return config;
}

/** Diferencia en días entre dos fechas YYYY-MM-DD. */
export function diasEntre(desde: string, hasta: string): number {
  const ms = Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Desplaza una fecha YYYY-MM-DD un número de días (negativo hacia atrás). */
export function sumarDias(fecha: string, dias: number): string {
  const ms = Date.parse(`${fecha}T00:00:00Z`) + dias * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Primer día del mes siguiente, para rangos semiabiertos [desde, hasta). */
export function inicioMes(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-01`;
}

export function inicioMesSiguiente(anio: number, mes: number): string {
  return mes === 12 ? `${anio + 1}-01-01` : inicioMes(anio, mes + 1);
}
