/**
 * Fecha y hora en la zona del colegio.
 *
 * Todo el sistema opera en América/Lima. Construir fechas con `new Date()`
 * en el navegador usa la zona del dispositivo, así que un portátil mal
 * configurado —o un usuario de viaje— vería otro día. Estas funciones fijan
 * la zona explícitamente para que la fecha del cliente coincida siempre con
 * la que el servidor va a registrar.
 */

const ZONA = 'America/Lima';
const LOCALE = 'es-PE';

/** Fecha de hoy en Lima como `YYYY-MM-DD`, apta para <input type="date"> y para la API. */
export function hoyEnLima(): string {
  // `en-CA` produce exactamente YYYY-MM-DD, sin depender de reordenar partes.
  return new Date().toLocaleDateString('en-CA', { timeZone: ZONA });
}

/**
 * Convierte `YYYY-MM-DD` en un Date estable.
 *
 * Se ancla al mediodía a propósito: `new Date('2026-03-15')` se interpreta
 * como medianoche UTC, que en Lima (UTC-5) es el día 14 a las 19:00 — el
 * clásico error de "se me va un día". Al mediodía ningún desfase horario
 * razonable cruza la frontera del día.
 */
export function desdeFechaISO(fecha: string): Date {
  return new Date(`${fecha}T12:00:00`);
}

/** "sábado, 15 de marzo de 2026" */
export function fechaLarga(fecha: string): string {
  return desdeFechaISO(fecha).toLocaleDateString(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: ZONA,
  });
}

/** "15 mar" — para etiquetas compactas y ejes de gráficos. */
export function fechaCorta(fecha: string): string {
  return desdeFechaISO(fecha).toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'short',
    timeZone: ZONA,
  });
}

/**
 * "07:42" — formato 24 horas.
 *
 * El formato de 12 h en español produce "7:42 a. m.", con espacios finos que
 * rompen la línea dentro de una celda estrecha y desalinean la columna. Un
 * control de entrada escolar se lee mejor en 24 h.
 */
export function hora(timestamp: string | undefined | null): string {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: ZONA,
  });
}

/** "07:42:15" — con segundos, para el reloj en vivo del escáner. */
export function horaConSegundos(date: Date): string {
  return date.toLocaleTimeString(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: ZONA,
  });
}

/** `true` si la fecha `YYYY-MM-DD` corresponde a hoy en Lima. */
export function esHoy(fecha: string): boolean {
  return fecha === hoyEnLima();
}
