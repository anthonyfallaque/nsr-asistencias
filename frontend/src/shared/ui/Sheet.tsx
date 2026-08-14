import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/lib/cn';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useScrollLock } from '@/shared/hooks/useScrollLock';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Título accesible. Se muestra salvo que `titleHidden` lo oculte. */
  title: string;
  titleHidden?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Hoja inferior.
 *
 * Es el patrón nativo de móvil para menús contextuales: aparece desde abajo,
 * al alcance del pulgar, en lugar de un desplegable anclado a un icono en la
 * esquina superior —que en una pantalla de seis pulgadas obliga a recolocar
 * la mano y suele quedar medio tapado por el borde—.
 *
 * Comparte con `Modal` las cuatro garantías de accesibilidad (foco confinado
 * y devuelto, Escape, bloqueo del scroll de fondo, anuncio como diálogo).
 * Se mantiene como componente aparte porque su geometría y su gesto son
 * distintos: aquí no hay tamaños, siempre ocupa el ancho completo y se ancla
 * abajo.
 */
export function Sheet({ open, onClose, title, titleHidden, children, className }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

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
    <div className="fixed inset-0 z-modal flex items-end justify-center">
      <div
        className="absolute inset-0 bg-content/25 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative w-full bg-surface border-t border-border shadow-overlay',
          'rounded-t-xl max-h-[85vh] flex flex-col animate-slide-up safe-bottom',
          className
        )}
      >
        {/* Asa: señala que el panel es descartable hacia abajo. Decorativa —
            el cierre real es el fondo, Escape o la propia acción elegida. */}
        <div className="flex justify-center pt-2.5 pb-1 shrink-0" aria-hidden="true">
          <span className="h-1 w-9 rounded-full bg-border-strong" />
        </div>

        <h2
          id={titleId}
          className={cn(
            titleHidden && 'sr-only',
            !titleHidden && 'px-4 py-2 text-md font-semibold text-content'
          )}
        >
          {title}
        </h2>

        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>,
    document.body
  );
}
