import { type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export interface FieldProps {
  /** Id del control que etiqueta. Obligatorio: sin él la etiqueta es decorativa. */
  htmlFor: string;
  label: string;
  /** Marca visual y semántica de campo obligatorio. */
  required?: boolean;
  /** Ayuda permanente. Se oculta cuando hay error, para no competir con él. */
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Envoltorio de campo de formulario: etiqueta, ayuda y error.
 *
 * Devuelve los ids que el control debe enlazar vía `aria-describedby`, de
 * modo que un lector de pantalla lea "Sección, obligatorio, el DNI debe
 * tener 8 dígitos" en lugar de anunciar un campo suelto y dejar el mensaje
 * de error huérfano en algún punto de la página.
 */
export function Field({
  htmlFor,
  label,
  required,
  hint,
  error,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-content-secondary">
        {label}
        {required && (
          <span className="text-danger ml-0.5" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (obligatorio)</span>}
      </label>

      {children}

      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-content-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Ids de descripción que el control debe declarar en `aria-describedby`. */
export function describedBy(id: string, hint?: string, error?: string): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}
