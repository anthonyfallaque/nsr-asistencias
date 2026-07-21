export type Rol = 'admin' | 'portero' | 'auxiliar' | 'tutora' | 'directora';
export type EstadoAsistencia = 'puntual' | 'tardanza' | 'ausente' | 'justificada' | 'ya_registrada';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
}

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

export interface ResultadoEscaneo {
  alumna: {
    nombres: string;
    apellidos: string;
    foto_url?: string;
    grado: string;
    seccion: string;
  };
  estado: EstadoAsistencia;
  hora_escaneo: string;
  nuevo: boolean;
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

export interface AsistenciaAlumna {
  id: string;
  nombres: string;
  apellidos: string;
  foto_url?: string;
  dni?: string;
  estado: EstadoAsistencia;
  hora_escaneo?: string;
  justificacion?: string;
}

export interface TendenciaDia {
  dia: string;
  fecha: string;
  puntuales: number;
  tardanzas: number;
  justificadas: number;
  ausentes: number;
  total: number;
}

export interface OfflineScan {
  qr_token: string;
  scanned_at: string;
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
