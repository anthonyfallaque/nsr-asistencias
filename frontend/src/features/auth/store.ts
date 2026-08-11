import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setToken, onSesionExpirada } from '@/shared/lib/http';
import { authApi, type Usuario } from './api';

interface AuthState {
  token: string | null;
  usuario: Usuario | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

/**
 * Sesión del usuario.
 *
 * `isAuthenticated` ya no se almacena: era un tercer dato que podía
 * contradecir a los otros dos —y lo hacía, porque persistía en localStorage
 * y sobrevivía a la caducidad del token—. Ahora se deriva de la presencia
 * del token, así que no puede mentir.
 */
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      usuario: null,

      login: async (email, password) => {
        const { token, usuario } = await authApi.login(email, password);
        setToken(token);
        set({ token, usuario });
      },

      logout: () => {
        setToken(null);
        set({ token: null, usuario: null });
      },
    }),
    {
      name: 'nsr-auth',
      partialize: (state) => ({ token: state.token, usuario: state.usuario }),
      // Al rehidratar desde localStorage hay que devolver el token al cliente
      // HTTP: es un módulo aparte y no se entera de que el store revivió.
      onRehydrateStorage: () => (state) => {
        if (state?.token) setToken(state.token);
      },
    }
  )
);

/** Selectores. Suscriben al componente solo al fragmento que usa. */
export const useUsuario = () => useAuth((s) => s.usuario);
export const useEstaAutenticado = () => useAuth((s) => s.token !== null);
export const useRol = () => useAuth((s) => s.usuario?.rol);

/**
 * Cierra la sesión cuando el servidor rechaza el token.
 *
 * Se registra una sola vez al cargar el módulo. Sin esto, un token caducado
 * dejaba la aplicación en un estado en el que parecía haber sesión iniciada
 * pero toda acción fallaba, y nadie sacaba al usuario de ahí.
 */
onSesionExpirada(() => {
  useAuth.getState().logout();
});
