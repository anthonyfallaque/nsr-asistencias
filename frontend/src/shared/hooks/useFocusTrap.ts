import { useEffect, type RefObject } from 'react';

/** Elementos que reciben foco por teclado, excluyendo los apartados con tabindex negativo. */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Confina el foco del teclado dentro de un contenedor mientras está activo y
 * lo devuelve al elemento que lo abrió al cerrarse.
 *
 * Sin esto, un modal es una trampa al revés: el usuario de teclado tabula y
 * sale del diálogo hacia la página de fondo —que sigue ahí, visible bajo el
 * overlay— sin ninguna forma de saber dónde está el foco ni cómo volver.
 */
export function useFocusTrap(ref: RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active) return;

    const container = ref.current;
    if (!container) return;

    // Se guarda antes de mover el foco para poder restaurarlo al cerrar.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );

    // Enfocar el primer control útil; si no hay ninguno, el propio contenedor.
    const first = focusables()[0];
    if (first) {
      first.focus();
    } else {
      container.setAttribute('tabindex', '-1');
      container.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      const current = document.activeElement;

      // Cierra el ciclo por ambos extremos.
      if (event.shiftKey && current === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && current === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Devolver el foco es lo que permite continuar donde se estaba:
      // sin esto el foco vuelve al <body> y se pierde la posición.
      previouslyFocused?.focus?.();
    };
  }, [ref, active]);
}
