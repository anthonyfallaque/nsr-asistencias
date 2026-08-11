import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useScrollLock } from '@/shared/hooks/useScrollLock';
import { Button } from './Button';

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-2xl',
} as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Fila de acciones al pie. Se separa del cuerpo para que el contenido pueda desplazarse sin arrastrarlas. */
  footer?: ReactNode;
  size?: keyof typeof SIZES;
  /** Desactívalo en formularios con datos sin guardar, para no perderlos por un clic despistado. */
  closeOnBackdrop?: boolean;
}

/**
 * Diálogo modal accesible.
 *
 * Cubre las cuatro obligaciones que los modales hechos a mano suelen
 * incumplir, y que el sistema anterior incumplía las cuatro:
 *
 *  1. Confina el foco del teclado y lo devuelve al cerrar (`useFocusTrap`).
 *  2. Cierra con Escape.
 *  3. Bloquea el desplazamiento del fondo (`useScrollLock`).
 *  4. Se anuncia como diálogo (`role`, `aria-modal`, `aria-labelledby`).
 *
 * Se renderiza en un portal sobre `document.body` para que ningún
 * `overflow: hidden` ni contexto de apilamiento de un ancestro pueda
 * recortarlo — la causa habitual de modales que aparecen a medias.
 *
 * En móvil se presenta como hoja inferior: el pulgar alcanza las acciones
 * sin recolocar la mano.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useFocusTrap(panelRef, open);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      // Ancla para los estilos de impresión: permite aislar el contenido del
      // diálogo del resto de la aplicación al mandar a imprimir.
      data-print-root
      className="fixed inset-0 z-modal flex items-end justify-center sm:items-center sm:p-4"
    >
      <div
        className="absolute inset-0 bg-content/25 backdrop-blur-[2px] animate-fade-in"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'relative w-full bg-surface border border-border shadow-overlay',
          'rounded-t-xl sm:rounded-xl',
          'max-h-[92vh] flex flex-col',
          'animate-slide-up sm:animate-scale-in',
          SIZES[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 id={titleId} className="text-md font-semibold text-content">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-sm text-content-muted mt-0.5">
                {description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={onClose}
            aria-label="Cerrar"
            icon={<X className="h-4 w-4" aria-hidden="true" />}
            className="-mr-1.5 -mt-0.5 shrink-0"
          />
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border bg-surface-sunken rounded-b-xl shrink-0 safe-bottom">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
