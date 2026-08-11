import { http } from '@/shared/lib/http';

export interface Alumna {
  id: string;
  nombres: string;
  apellidos: string;
  dni?: string;
  foto_url?: string;
  grado: string;
  seccion: string;
  seccion_id: number;
  activa: boolean;
}

export interface Grado {
  id: number;
  nombre: string;
}

export interface Seccion {
  id: number;
  nombre: string;
  grado: string;
  grado_id: number;
  tutora?: string;
}

export interface CodigoQR {
  qr_image: string;
  nombre_completo: string;
  grado: string;
  seccion: string;
}

export interface NuevaAlumna {
  nombres: string;
  apellidos: string;
  dni?: string;
  seccion_id: number;
  foto_url?: string;
}

/** Respuesta paginada. El backend acota el tamaño; el cliente no puede pedir "todo". */
export interface Pagina<T> {
  datos: T[];
  total: number;
}

export interface FiltrosAlumnas {
  grado?: string;
  seccion_id?: number;
  buscar?: string;
  pagina?: number;
}

export const alumnasApi = {
  listar: (filtros: FiltrosAlumnas = {}) =>
    http.get<Pagina<Alumna> | Alumna[]>('/alumnas', {
      query: {
        grado: filtros.grado,
        seccion_id: filtros.seccion_id,
        buscar: filtros.buscar,
        pagina: filtros.pagina,
      },
    }),

  crear: (data: NuevaAlumna) => http.post<{ id: string; qr_token: string }>('/alumnas', data),

  actualizar: (id: string, data: Partial<NuevaAlumna>) =>
    http.put<{ ok: boolean }>(`/alumnas/${id}`, data),

  desactivar: (id: string) => http.delete<{ ok: boolean }>(`/alumnas/${id}`),

  qr: (id: string) => http.get<CodigoQR>(`/alumnas/${id}/qr`),

  grados: () => http.get<Grado[]>('/alumnas/grados'),

  secciones: (grado_id?: number) =>
    http.get<Seccion[]>('/alumnas/secciones', { query: { grado_id } }),
};

/**
 * Normaliza la respuesta del listado.
 *
 * El backend está migrando a respuesta paginada; esto acepta ambas formas
 * para que el frontend no dependa del orden de despliegue de los dos
 * servicios, que se despliegan por separado.
 */
export function extraerAlumnas(respuesta: Pagina<Alumna> | Alumna[]): {
  alumnas: Alumna[];
  total: number;
} {
  if (Array.isArray(respuesta)) {
    return { alumnas: respuesta, total: respuesta.length };
  }
  return { alumnas: respuesta.datos, total: respuesta.total };
}
