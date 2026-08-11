import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

const SIZES = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-6 w-6',
} as const;

export interface SpinnerProps {
  size?: keyof typeof SIZES;
  className?: string;
  /** Texto anunciado a lectores de pantalla. `null` si otro elemento ya lo anuncia. */
  label?: string | null;
}

/**
 * Indicador de carga. Para carga de contenido prefiere `Skeleton`: preserva
 * la forma de lo que va a llegar y evita el salto de layout. El spinner es
 * para acciones (un botón enviando), no para pantallas.
 */
export function Spinner({ size = 'md', className, label = 'Cargando' }: SpinnerProps) {
  return (
    <>
      <Loader2 className={cn('animate-spin', SIZES[size], className)} aria-hidden="true" />
      {label ? <span className="sr-only">{label}</span> : null}
    </>
  );
}
