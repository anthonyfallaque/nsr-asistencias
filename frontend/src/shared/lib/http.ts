const BASE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api`;

/**
 * Error de API con la información necesaria para decidir qué hacer.
 *
 * El cliente anterior lanzaba `Error` con un texto suelto, de modo que las
 * pantallas no podían distinguir "no autorizado" de "sección inexistente" ni
 * de "se cayó la red", y todos los fallos acababan mostrándose igual.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Código estable del backend, apto para ramificar lógica. */
    readonly codigo?: string,
    readonly detalles?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Fallo de red o servidor caído: reintentar tiene sentido. */
  get esDeRed(): boolean {
    return this.status === 0;
  }

  /** El servidor rechazó el ritmo de peticiones. */
  get esLimiteDeTasa(): boolean {
    return this.status === 429;
  }

  /** Merece reintento automático; un 4xx de validación no. */
  get esReintentable(): boolean {
    return this.esDeRed || this.esLimiteDeTasa || this.status >= 500;
  }
}

/* ── Sesión ──────────────────────────────────────────────────────────────── */

let tokenActual: string | null = null;
let alExpirarSesion: (() => void) | null = null;

/**
 * Fuente única del token para las peticiones.
 *
 * Antes convivían dos: el store de Zustand y una lectura directa de
 * `localStorage` dentro del cliente. Podían desincronizarse y nadie sabía
 * cuál mandaba. Ahora el store empuja aquí y este módulo es el único que
 * decide qué se envía.
 */
export function setToken(token: string | null): void {
  tokenActual = token;
}

/**
 * Registra qué hacer cuando el servidor responde 401.
 *
 * Se inyecta desde fuera en lugar de importar el store para evitar el ciclo
 * `http → store → http`, y para que este módulo siga siendo comprobable de
 * forma aislada.
 */
export function onSesionExpirada(handler: () => void): void {
  alExpirarSesion = handler;
}

/* ── Cliente ─────────────────────────────────────────────────────────────── */

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Parámetros de consulta; los `undefined` se descartan. */
  query?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  if (!query) return `${BASE_URL}${path}`;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }

  const qs = params.toString();
  return `${BASE_URL}${path}${qs ? `?${qs}` : ''}`;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, headers, ...rest } = options;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      ...rest,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(tokenActual ? { Authorization: `Bearer ${tokenActual}` } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    // fetch solo rechaza por fallo de red; un 500 sí resuelve.
    throw new ApiError(0, 'No hay conexión con el servidor');
  }

  if (response.status === 401) {
    // El token caducó o fue revocado. Sin esto la aplicación quedaba en
    // sesión zombi: la interfaz parecía autenticada y cada acción fallaba
    // en silencio hasta que el usuario recargaba a mano.
    alExpirarSesion?.();
    throw new ApiError(401, 'Tu sesión ha caducado. Vuelve a iniciar sesión.');
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; mensaje?: string; codigo?: string; detalles?: unknown }
      | null;

    throw new ApiError(
      response.status,
      payload?.mensaje ?? payload?.error ?? mensajePorDefecto(response.status),
      payload?.codigo,
      payload?.detalles
    );
  }

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

function mensajePorDefecto(status: number): string {
  if (status === 403) return 'No tienes permiso para hacer esto';
  if (status === 404) return 'No se encontró lo que buscabas';
  if (status === 409) return 'Ese registro ya existe';
  if (status === 429) return 'Demasiadas peticiones. Espera unos segundos.';
  if (status >= 500) return 'El servidor tuvo un problema. Inténtalo de nuevo.';
  return 'No se pudo completar la operación';
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
