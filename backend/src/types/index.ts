export type Rol = 'admin' | 'portero' | 'auxiliar' | 'tutora' | 'directora';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
}

export interface JwtPayload {
  sub: string;       // usuario id
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

export interface Asistencia {
  id: string;
  alumna_id: string;
  fecha: string;
  hora_escaneo?: string;
  estado: EstadoAsistencia;
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

// Express request augmentado con usuario autenticado
declare global {
  namespace Express {
    interface Request {
      usuario?: Usuario;
    }
  }
}
