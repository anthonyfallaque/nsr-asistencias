import type {
  ResultadoEscaneo, ResumenSeccion, AsistenciaAlumna,
  Alumna, Grado, Seccion, OfflineScan, TendenciaDia,
} from '../types';

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function http<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Auth ─────────────────────────────────────────────────────
export const auth = {
  login: (email: string, password: string) =>
    http<{ token: string; usuario: { id: string; email: string; nombre: string; rol: string } }>(
      '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }
    ),
  me: () => http<{ id: string; email: string; nombre: string; rol: string }>('/auth/me'),
};

// ── Asistencias ──────────────────────────────────────────────
export const asistencias = {
  escanear: (qr_token: string, scanned_at?: string) =>
    http<ResultadoEscaneo>('/asistencias/escanear', {
      method: 'POST',
      body: JSON.stringify({ qr_token, scanned_at }),
    }),

  syncOffline: (cola: OfflineScan[]) =>
    http<{ procesados: number }>('/asistencias/sync-offline', {
      method: 'POST',
      body: JSON.stringify(cola),
    }),

  resumen: () =>
    http<ResumenSeccion[]>('/asistencias/resumen'),

  porSeccion: (seccionId: number, fecha?: string) =>
    http<AsistenciaAlumna[]>(
      `/asistencias/seccion/${seccionId}${fecha ? `?fecha=${fecha}` : ''}`
    ),

  justificar: (alumna_id: string, fecha: string, justificacion: string) =>
    http<{ ok: boolean }>('/asistencias/justificar', {
      method: 'POST',
      body: JSON.stringify({ alumna_id, fecha, justificacion }),
    }),

  tendencia: (dias = 7) =>
    http<TendenciaDia[]>(`/asistencias/tendencia?dias=${dias}`),

  marcarManual: (alumna_id: string, fecha: string, estado: string, justificacion?: string) =>
    http<{ ok: boolean }>('/asistencias/marcar-manual', {
      method: 'POST',
      body: JSON.stringify({ alumna_id, fecha, estado, justificacion }),
    }),
};

// ── Alumnas ──────────────────────────────────────────────────
export const alumnas = {
  listar: (params?: { grado?: string; seccion_id?: number; buscar?: string }) => {
    const qs = new URLSearchParams();
    if (params?.grado)      qs.set('grado', params.grado);
    if (params?.seccion_id) qs.set('seccion_id', String(params.seccion_id));
    if (params?.buscar)     qs.set('buscar', params.buscar);
    return http<Alumna[]>(`/alumnas${qs.toString() ? '?' + qs : ''}`);
  },

  grados:   () => http<Grado[]>('/alumnas/grados'),
  secciones: (grado_id?: number) =>
    http<Seccion[]>(`/alumnas/secciones${grado_id ? `?grado_id=${grado_id}` : ''}`),

  qr: (id: string) =>
    http<{ qr_image: string; nombre_completo: string; grado: string; seccion: string }>(
      `/alumnas/${id}/qr`
    ),

  crear: (data: { nombres: string; apellidos: string; dni?: string; seccion_id: number; foto_url?: string }) =>
    http<{ id: string; qr_token: string }>('/alumnas', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ── Reportes ─────────────────────────────────────────────────
export const reportes = {
  rango: (desde: string, hasta: string, grado?: string, seccion_id?: number) => {
    const qs = new URLSearchParams({ desde, hasta });
    if (grado)      qs.set('grado', grado);
    if (seccion_id) qs.set('seccion_id', String(seccion_id));
    return http<Record<string, unknown>[]>(`/reportes/rango?${qs}`);
  },
  alumna: (id: string, mes: number, anio: number) =>
    http<Record<string, unknown>>(`/reportes/alumna/${id}?mes=${mes}&anio=${anio}`),
  ranking: (desde?: string, hasta?: string) => {
    const qs = new URLSearchParams();
    if (desde) qs.set('desde', desde);
    if (hasta) qs.set('hasta', hasta);
    return http<Record<string, unknown>[]>(`/reportes/ranking-tardanzas?${qs}`);
  },
};
