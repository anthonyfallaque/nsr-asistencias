import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export interface EmptyStateProps {
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  title: string;
  /** Qué hacer a continuación. Un vacío sin salida deja al usuario atascado. */
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Estado vacío. Distinto de un estado de error: aquí no ha fallado nada,
 * simplemente todavía no hay datos.
 *
 * Confundir ambos es el fallo de UX más caro que tenía el sistema anterior:
 * cuando la API caía, la pantalla decía "No se encontraron alumnas" — el
 * mismo mensaje que si el colegio no tuviera ninguna. Para el fallo real
 * existe `ErrorState`, que sí ofrece reintentar.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = 'md',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        size === 'md' ? 'px-6 py-14' : 'px-4 py-8',
        className
      )}
    >
      {Icon && (
        <div
          className={cn(
            'flex items-center justify-center rounded-lg bg-surface-sunken border border-border mb-3',
            size === 'md' ? 'h-10 w-10' : 'h-8 w-8'
          )}
        >
          <Icon
            className={cn('text-content-subtle', size === 'md' ? 'h-5 w-5' : 'h-4 w-4')}
            aria-hidden="true"
          />
        </div>
      )}
      <p className="text-base font-medium text-content">{title}</p>
      {description && (
        <p className="text-sm text-content-muted mt-1 max-w-sm text-balance">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
