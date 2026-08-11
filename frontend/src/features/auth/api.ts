import { http } from '@/shared/lib/http';
import type { Rol } from '@/config/navigation';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
}

interface RespuestaLogin {
  token: string;
  usuario: Usuario;
}

export const authApi = {
  login: (email: string, password: string) =>
    http.post<RespuestaLogin>('/auth/login', { email, password }),

  /** Revalida la sesión contra el servidor; detecta tokens revocados. */
  me: () => http.get<Usuario>('/auth/me'),
};
