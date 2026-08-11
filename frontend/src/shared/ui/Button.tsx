import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { Spinner } from './Spinner';

/**
 * Las variantes se corresponden con niveles de énfasis, no con colores.
 * Quien escribe una pantalla decide "esto es la acción principal", no
 * "esto es azul" — así el sistema puede recolorearse sin reescribir vistas.
 *
 * Deliberadamente NO hay `active:scale-95`: encoger el botón al pulsarlo es
 * un gesto de app móvil híbrida y es de las cosas que más delatan una
 * interfaz improvisada. El feedback aquí es un cambio de fondo inmediato.
 */
const VARIANTS = {
  primary:
    'bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent-active shadow-xs',
  secondary:
    'bg-surface text-content border border-border hover:bg-surface-hover active:bg-surface-active shadow-xs',
  ghost:
    'text-content-secondary hover:bg-surface-hover hover:text-content active:bg-surface-active',
  danger:
    'bg-danger text-white hover:brightness-110 active:brightness-95 shadow-xs',
  'danger-subtle':
    'bg-danger-soft text-danger border border-danger-border hover:brightness-[0.98]',
} as const;

const SIZES = {
  sm: 'h-7 px-2.5 text-xs gap-1.5 rounded-sm',
  md: 'h-8 px-3 text-base gap-1.5 rounded-md',
  lg: 'h-10 px-4 text-base gap-2 rounded-md',
} as const;

/** Cuadrado, para botones que solo contienen un icono. */
const ICON_SIZES = {
  sm: 'h-7 w-7 rounded-sm',
  md: 'h-8 w-8 rounded-md',
  lg: 'h-10 w-10 rounded-md',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  /** Muestra un spinner y deshabilita el botón sin cambiar su ancho. */
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  /**
   * Botón cuadrado sin texto. Exige `aria-label`: un botón cuyo único
   * contenido es un icono es invisible para un lector de pantalla.
   */
  iconOnly?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    icon,
    iconRight,
    fullWidth = false,
    iconOnly = false,
    disabled,
    className,
    children,
    type = 'button',
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap',
        'transition-colors duration-fast ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
        'disabled:pointer-events-none disabled:opacity-50',
        'select-none',
        VARIANTS[variant],
        iconOnly ? ICON_SIZES[size] : SIZES[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? (
        <Spinner size={size === 'lg' ? 'md' : 'sm'} label={null} />
      ) : (
        icon
      )}
      {!iconOnly && children}
      {!loading && iconRight}
    </button>
  );
});
