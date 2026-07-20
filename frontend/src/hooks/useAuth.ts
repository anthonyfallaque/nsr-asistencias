import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Usuario } from '../types';
import { auth } from '../services/api';

interface AuthState {
  token: string | null;
  usuario: Usuario | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      usuario: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const data = await auth.login(email, password);
        localStorage.setItem('token', data.token);
        set({
          token: data.token,
          usuario: data.usuario as Usuario,
          isAuthenticated: true,
        });
      },

      logout: () => {
        localStorage.removeItem('token');
        set({ token: null, usuario: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (s) => ({ token: s.token, usuario: s.usuario, isAuthenticated: s.isAuthenticated }),
    }
  )
);
