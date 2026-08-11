import { http } from '@/shared/lib/http';
import type { EstadoAsistencia, ResultadoEscaneo } from '@/shared/domain/asistencia';

export interface ResumenSeccion {
  seccion_id: number;
  grado: string;
  seccion: string;
  total: number;
  puntuales: number;
  tardanzas: number;
  justificadas: number;
  ausentes: number;
}

export interface AsistenciaAlumna {
  id: string;
  nombres: string;
  apellidos: string;
  dni?: string;
  foto_url?: string;
  estado: EstadoAsistencia | null;
  hora_escaneo?: string;
  justificacion?: string;
}

export interface TendenciaDia {
  fecha: string;
  dia: string;
  total: number;
  puntuales: number;
  tardanzas: number;
  justificadas: number;
  ausentes: number;
}

export interface Escaneo {
  alumna: {
    nombres: string;
    apellidos: string;
    foto_url?: string;
    grado: string;
    seccion: string;
  };
  estado: ResultadoEscaneo;
  hora_escaneo: string;
  nuevo: boolean;
}

export interface EscaneoOffline {
  qr_token: string;
  scanned_at: string;
}

export const asistenciasApi = {
  /**
   * Registra una entrada.
   *
   * Ya no se envía `scanned_at`: la hora la fija el servidor. Aceptarla del
   * cliente permitía convertir una tardanza en puntual desde el propio
   * dispositivo de la puerta.
   */
  escanear: (qr_token: string) => http.post<Escaneo>('/asistencias/escanear', { qr_token }),

  sincronizarOffline: (cola: EscaneoOffline[]) =>
    http.post<{ resultados: Array<{ indice: number; ok: boolean; error?: string }> }>(
      '/asistencias/sync-offline',
      cola
    ),

  /** Totales por sección. La fecha es explícita: el resumen ya no está fijado a hoy. */
  resumen: (fecha: string) =>
    http.get<ResumenSeccion[]>('/asistencias/resumen', { query: { fecha } }),

  porSeccion: (seccionId: number, fecha: string) =>
    http.get<AsistenciaAlumna[]>(`/asistencias/seccion/${seccionId}`, { query: { fecha } }),

  tendencia: (dias = 7) =>
    http.get<TendenciaDia[]>('/asistencias/tendencia', { query: { dias } }),

  justificar: (alumna_id: string, fecha: string, justificacion: string) =>
    http.post<{ ok: boolean }>('/asistencias/justificar', { alumna_id, fecha, justificacion }),

  marcarManual: (alumna_id: string, fecha: string, estado: EstadoAsistencia, justificacion?: string) =>
    http.post<{ ok: boolean }>('/asistencias/marcar-manual', {
      alumna_id,
      fecha,
      estado,
      justificacion,
    }),
};
