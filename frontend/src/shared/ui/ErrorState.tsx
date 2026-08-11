import { AlertTriangle, RotateCw } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  /** Mensaje del fallo. Si se omite, se usa uno genérico pero honesto. */
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Fallo al cargar datos, con salida.
 *
 * Existe porque el sistema anterior no distinguía "falló la petición" de
 * "no hay datos": cuando la API caía, la pantalla decía "No se encontraron
 * alumnas" — indistinguible de un colegio sin alumnas. Un error debe
 * declararse como error y ofrecer reintentar.
 */
export function ErrorState({
  title = 'No se pudo cargar la información',
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-12',
        className
      )}
    >
      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-danger-soft border border-danger-border mb-3">
        <AlertTriangle className="h-5 w-5 text-danger" aria-hidden="true" />
      </div>
      <p className="text-base font-medium text-content">{title}</p>
      <p className="text-sm text-content-muted mt-1 max-w-sm text-balance">
        {message ?? 'Revisa tu conexión e inténtalo de nuevo.'}
      </p>
      {onRetry && (
        <Button
          variant="secondary"
          size="md"
          onClick={onRetry}
          icon={<RotateCw className="h-3.5 w-3.5" aria-hidden="true" />}
          className="mt-4"
        >
          Reintentar
        </Button>
      )}
    </div>
  );
}
