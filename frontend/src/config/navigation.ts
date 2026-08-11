import { ScanLine, LayoutDashboard, Users, FileBarChart, type LucideIcon } from 'lucide-react';

export type Rol = 'admin' | 'portero' | 'auxiliar' | 'tutora' | 'directora';

export interface NavItem {
  to: string;
  label: string;
  /** Descripción corta para menús ampliados y ayudas contextuales. */
  description: string;
  icon: LucideIcon;
  roles: readonly Rol[];
}

/**
 * Definición única de la navegación y de quién ve qué.
 *
 * Antes existía por duplicado —una copia en la barra lateral de escritorio y
 * otra en la barra inferior de móvil— con los roles repetidos y los iconos
 * ya divergidos: el mismo "Dashboard" se dibujaba distinto en cada una.
 * Añadir una sección obligaba a editar dos archivos y a acordarse de
 * replicar el icono.
 *
 * Ahora ambas barras consumen este array y no pueden desincronizarse.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    to: '/scanner',
    label: 'Escáner',
    description: 'Registrar entrada por código QR',
    icon: ScanLine,
    roles: ['portero', 'auxiliar', 'admin'],
  },
  {
    to: '/dashboard',
    label: 'Dashboard',
    description: 'Asistencia del día por sección',
    icon: LayoutDashboard,
    roles: ['auxiliar', 'tutora', 'directora', 'admin'],
  },
  {
    to: '/alumnas',
    label: 'Alumnas',
    description: 'Padrón y códigos QR',
    icon: Users,
    roles: ['admin', 'auxiliar', 'directora'],
  },
  {
    to: '/reportes',
    label: 'Reportes',
    description: 'Histórico y exportación',
    icon: FileBarChart,
    roles: ['auxiliar', 'tutora', 'directora', 'admin'],
  },
] as const;

export const ROL_LABEL: Record<Rol, string> = {
  admin: 'Administrador',
  portero: 'Portero',
  auxiliar: 'Auxiliar',
  tutora: 'Tutora',
  directora: 'Directora',
};

/**
 * Permisos por capacidad, no por rol.
 *
 * Las pantallas preguntan `puede(rol, 'alumnas.crear')` en lugar de
 * `rol === 'admin'`. La diferencia importa cuando mañana haya que dar de
 * alta alumnas también a la auxiliar: se cambia una línea aquí y ninguna
 * pantalla se toca. Es lo que permite que el sistema crezca en roles sin
 * que los permisos queden repartidos por el código.
 */
export const CAPACIDADES = {
  'alumnas.ver': ['admin', 'auxiliar', 'directora'],
  'alumnas.crear': ['admin'],
  'alumnas.editar': ['admin'],
  'alumnas.verQR': ['admin', 'auxiliar', 'directora'],
  'asistencias.escanear': ['portero', 'auxiliar', 'admin'],
  'asistencias.ver': ['auxiliar', 'tutora', 'directora', 'admin'],
  'asistencias.justificar': ['auxiliar', 'tutora', 'directora', 'admin'],
  'reportes.ver': ['auxiliar', 'tutora', 'directora', 'admin'],
  'reportes.exportar': ['auxiliar', 'directora', 'admin'],
} as const satisfies Record<string, readonly Rol[]>;

export type Capacidad = keyof typeof CAPACIDADES;

export function puede(rol: Rol | undefined, capacidad: Capacidad): boolean {
  if (!rol) return false;
  return (CAPACIDADES[capacidad] as readonly Rol[]).includes(rol);
}

/** Items de navegación visibles para un rol, en orden. */
export function navParaRol(rol: Rol | undefined): NavItem[] {
  if (!rol) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(rol));
}

/**
 * Ruta de inicio según el rol.
 *
 * El portero trabaja de pie en la puerta con el móvil: llevarlo al dashboard
 * y obligarlo a un toque más para llegar al escáner es fricción diaria
 * multiplicada por cada mañana del curso.
 */
export function rutaInicial(rol: Rol | undefined): string {
  if (rol === 'portero') return '/scanner';
  if (rol && navParaRol(rol).length > 0) return navParaRol(rol)[0]!.to;
  return '/dashboard';
}
