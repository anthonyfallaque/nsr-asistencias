import { cn } from '@/shared/lib/cn';

export interface SkeletonProps {
  className?: string;
}

/**
 * Marcador de posición con la forma del contenido que va a llegar.
 *
 * Sustituye al spinner centrado en la carga de pantallas: al reservar la
 * geometría real, el contenido no empuja el layout al aparecer y la espera
 * se percibe más corta porque la página ya tiene estructura.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'rounded-sm bg-[linear-gradient(90deg,var(--color-surface-sunken)_25%,var(--color-surface-hover)_37%,var(--color-surface-sunken)_63%)]',
        'bg-[length:400%_100%] animate-shimmer',
        className
      )}
    />
  );
}

/** Bloque de líneas de texto de anchos decrecientes, como un párrafo real. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

/**
 * Filas de lista con avatar y dos líneas. Cubre el patrón dominante del
 * sistema (listados de alumnas y de asistencias).
 */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-8 w-8 rounded-md shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-48 max-w-[60%]" />
            <Skeleton className="h-2.5 w-32 max-w-[40%]" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full shrink-0" />
        </div>
      ))}
      <span className="sr-only">Cargando contenido</span>
    </div>
  );
}
