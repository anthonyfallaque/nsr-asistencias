import { useEffect, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Acciones principales de la pantalla, alineadas a la derecha. */
  actions?: ReactNode;
  className?: string;
}

/**
 * Encabezado de pantalla.
 *
 * Unifica el título, el subtítulo y las acciones principales, que antes
 * cada página resolvía a su manera con tamaños y pesos distintos. También
 * fija el `<title>` del documento: hasta ahora todas las pestañas se
 * llamaban igual, lo que hace inservible tener varias abiertas.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  useEffect(() => {
    document.title = `${title} · Asistencias NSR`;
  }, [title]);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-content">{title}</h1>
        {description && (
          <div className="text-sm text-content-muted mt-1">{description}</div>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
      )}
    </div>
  );
}
