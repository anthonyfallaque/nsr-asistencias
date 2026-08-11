import { http } from '@/shared/lib/http';
import type { EstadoAsistencia } from '@/shared/domain/asistencia';

/**
 * Fila del reporte detallado.
 *
 * `estado` puede ser `null`: el backend hace LEFT JOIN contra las
 * asistencias, y un día sin registro no produce fila de asistencia. Ese
 * `null` significa ausente y se normaliza en la capa de dominio, no aquí.
 */
export interface FilaReporte {
  alumna_id: string;
  apellidos: string;
  nombres: string;
  dni?: string;
  grado: string;
  seccion: string;
  fecha: string;
  estado: EstadoAsistencia | null;
  hora?: string;
}

export interface FilaRanking {
  alumna_id: string;
  apellidos: string;
  nombres: string;
  grado: string;
  seccion: string;
  tardanzas: number;
  ausencias: number;
}

export interface FiltrosReporte {
  desde: string;
  hasta: string;
  grado?: string;
  seccion_id?: number;
}

export interface RespuestaReporte {
  datos: FilaReporte[];
  total: number;
}

export const reportesApi = {
  rango: (filtros: FiltrosReporte) =>
    http.get<RespuestaReporte | FilaReporte[]>('/reportes/rango', {
      query: {
        desde: filtros.desde,
        hasta: filtros.hasta,
        grado: filtros.grado,
        seccion_id: filtros.seccion_id,
      },
    }),

  ranking: (desde: string, hasta: string) =>
    http.get<FilaRanking[]>('/reportes/ranking-tardanzas', { query: { desde, hasta } }),

  alumna: (id: string, mes: number, anio: number) =>
    http.get<Record<string, unknown>>(`/reportes/alumna/${id}`, { query: { mes, anio } }),
};

/** Acepta la forma paginada y la antigua, igual que el listado de alumnas. */
export function extraerFilas(respuesta: RespuestaReporte | FilaReporte[]): {
  filas: FilaReporte[];
  total: number;
} {
  if (Array.isArray(respuesta)) {
    return { filas: respuesta, total: respuesta.length };
  }
  return { filas: respuesta.datos, total: respuesta.total };
}
