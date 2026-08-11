/**
 * Fábrica de claves de consulta.
 *
 * Antes las claves eran cadenas sueltas escritas a mano en cada pantalla
 * (`['resumen']`, `['alumnas', grado, buscar]`, `['tendencia', 7]`), de modo
 * que invalidar tras una mutación exigía recordar la forma exacta usada en
 * otro archivo. Un error tipográfico no fallaba: simplemente la interfaz se
 * quedaba con datos viejos, que es el peor modo de fallar.
 *
 * Con jerarquía explícita, `queryKeys.alumnas.all` invalida todas las
 * variantes de listado sin conocer sus filtros.
 */
export const queryKeys = {
  asistencias: {
    all: ['asistencias'] as const,
    resumen: (fecha: string) => ['asistencias', 'resumen', fecha] as const,
    seccion: (seccionId: number, fecha: string) =>
      ['asistencias', 'seccion', seccionId, fecha] as const,
    tendencia: (dias: number) => ['asistencias', 'tendencia', dias] as const,
  },

  alumnas: {
    all: ['alumnas'] as const,
    lista: (filtros: { grado?: string; seccionId?: number; buscar?: string }) =>
      ['alumnas', 'lista', filtros] as const,
    qr: (id: string) => ['alumnas', 'qr', id] as const,
    grados: ['alumnas', 'grados'] as const,
    secciones: (gradoId?: number) => ['alumnas', 'secciones', gradoId ?? null] as const,
  },

  reportes: {
    all: ['reportes'] as const,
    rango: (filtros: { desde: string; hasta: string; grado?: string; seccionId?: number }) =>
      ['reportes', 'rango', filtros] as const,
    ranking: (desde: string, hasta: string) => ['reportes', 'ranking', desde, hasta] as const,
  },
} as const;
