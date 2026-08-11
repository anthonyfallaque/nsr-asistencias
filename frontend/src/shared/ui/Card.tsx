import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

/**
 * Superficie base del sistema. La separación la produce el borde de 1px,
 * no la sombra — es lo que distingue una interfaz sobria de una que flota.
 *
 * Se compone en partes (`Card` / `CardHeader` / `CardBody`) en lugar de
 * recibir props de contenido: así una tarjeta puede alojar una tabla a
 * sangre, un gráfico con su propio padding o una lista dividida, sin que el
 * componente tenga que anticipar cada caso.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-surface border border-border rounded-lg', className)}
      {...props}
    />
  );
}

// `title` se excluye de los atributos nativos: aquí es el encabezado visible
// del bloque, no el tooltip del navegador, y admite nodos además de texto.
export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  /** Acciones alineadas a la derecha: botones, filtros, contadores. */
  actions?: ReactNode;
}

export function CardHeader({
  title,
  description,
  actions,
  className,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 px-4 py-3 border-b border-border',
        className
      )}
      {...props}
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-content truncate">{title}</h2>
        {description && (
          <p className="text-xs text-content-muted mt-0.5">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-surface-sunken rounded-b-lg',
        className
      )}
      {...props}
    />
  );
}
