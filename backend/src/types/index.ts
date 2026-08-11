export type Rol = 'admin' | 'portero' | 'auxiliar' | 'tutora' | 'directora';

export const ROLES: readonly Rol[] = ['admin', 'portero', 'auxiliar', 'tutora', 'directora'];

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  debe_cambiar_password: boolean;
}

export interface JwtPayload {
  sub: string; // usuario id
  email: string;
  rol: Rol;
  iat?: number;
  exp?: number;
}

export interface Alumna {
  id: string;
  nombres: string;
  apellidos: string;
  dni?: string;
  seccion_id: number;
  grado: string;
  seccion: string;
  qr_token: string;
  foto_url?: string;
  activa: boolean;
}

export type EstadoAsistencia = 'puntual' | 'tardanza' | 'ausente' | 'justificada';

/** Por qué vía entró el registro. El cliente no lo elige. */
export type OrigenAsistencia = 'escaneo' | 'offline' | 'manual';

export interface Asistencia {
  id: string;
  alumna_id: string;
  fecha: string;
  hora_escaneo?: string;
  estado: EstadoAsistencia;
  origen: OrigenAsistencia;
  seccion_id?: number;
  justificacion?: string;
  registrado_por?: string;
}

export interface ResumenSeccion {
  grado: string;
  seccion: string;
  seccion_id: number;
  total: number;
  puntuales: number;
  tardanzas: number;
  justificadas: number;
  ausentes: number;
}

/**
 * Ámbito de secciones que el usuario puede leer y modificar.
 * `null` = sin restricción (dirección y administración).
 * Se resuelve una vez por petición y viaja hasta el WHERE de cada
 * consulta; nunca se comprueba con un `if` en el controlador.
 */
export interface AmbitoUsuario {
  secciones: number[] | null;
}

/** Respuesta paginada uniforme. */
export interface Pagina<T> {
  datos: T[];
  total: number;
  pagina: number;
  por_pagina: number;
}

// Express request augmentado con usuario autenticado y su ámbito
declare global {
  namespace Express {
    interface Request {
      usuario?: Usuario;
      ambito?: AmbitoUsuario;
    }
  }
}
