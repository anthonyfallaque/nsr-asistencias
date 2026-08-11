import { useEffect } from 'react';

/**
 * Impide que la página de fondo se desplace mientras hay una capa modal
 * abierta.
 *
 * Compensa el ancho de la barra de desplazamiento con `padding-right`: al
 * ocultarla sin más, el contenido salta lateralmente unos píxeles y el
 * parpadeo se nota en cada apertura.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const { body, documentElement } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;

    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [active]);
}
