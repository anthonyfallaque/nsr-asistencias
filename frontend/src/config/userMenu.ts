import { KeyRound, LogOut, type LucideIcon } from 'lucide-react';

export interface AccionUsuario {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Marca las acciones destructivas o de salida, que se pintan aparte. */
  tono?: 'normal' | 'peligro';
  /** Separador visual antes de esta acción. */
  separarAntes?: boolean;
}

/**
 * Acciones del menú de usuario, definidas una sola vez.
 *
 * La barra lateral de escritorio y la hoja inferior de móvil consumen este
 * mismo array. Es la misma lección que la navegación: cuando cada vista
 * mantiene su propia copia, terminan divergiendo —y de hecho el móvil no
 * llegó a tener nunca ni "cerrar sesión"—.
 *
 * Añadir "Ajustes", "Ayuda" o "Mi perfil" el día de mañana es una entrada
 * aquí y aparece en los dos sitios a la vez.
 */
export const ACCIONES_USUARIO: readonly AccionUsuario[] = [
  {
    id: 'cambiar-password',
    label: 'Cambiar contraseña',
    icon: KeyRound,
  },
  {
    id: 'cerrar-sesion',
    label: 'Cerrar sesión',
    icon: LogOut,
    tono: 'peligro',
    separarAntes: true,
  },
] as const;

export type IdAccionUsuario = (typeof ACCIONES_USUARIO)[number]['id'];
