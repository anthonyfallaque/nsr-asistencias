import { http } from '@/shared/lib/http';
import type { Rol } from '@/config/navigation';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  /**
   * El servidor marca así las cuentas con contraseña inicial o restablecida.
   * La interfaz insiste hasta que se cambie.
   */
  debe_cambiar_password?: boolean;
}

interface RespuestaLogin {
  token: string;
  usuario: Usuario;
}

/** Reglas del servidor. Se replican aquí solo para avisar antes de enviar. */
export const REGLAS_PASSWORD = {
  minimo: 10,
  descripcion: 'Al menos 10 caracteres, combinando letras y números.',
};

export function validarPassword(valor: string): string | null {
  if (valor.length < REGLAS_PASSWORD.minimo) {
    return `Debe tener al menos ${REGLAS_PASSWORD.minimo} caracteres`;
  }
  if (!/[a-zA-Z]/.test(valor) || !/\d/.test(valor)) {
    return 'Debe combinar letras y números';
  }
  return null;
}

export const authApi = {
  login: (email: string, password: string) =>
    http.post<RespuestaLogin>('/auth/login', { email, password }),

  /** Revalida la sesión contra el servidor; detecta tokens revocados. */
  me: () => http.get<Usuario>('/auth/me'),

  cambiarPassword: (actual: string, nueva: string) =>
    http.post<{ ok: boolean }>('/auth/cambiar-password', { actual, nueva }),
};
