import { useCallback, useState } from 'react';

export interface Disclosure {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

/**
 * Estado abierto/cerrado con identidad de función estable.
 *
 * Sustituye al patrón `const [x, setX] = useState(false)` repetido en cada
 * pantalla: al no recrear los manejadores en cada render, los componentes
 * memoizados que los reciben dejan de re-renderizarse sin motivo.
 */
export function useDisclosure(initial = false): Disclosure {
  const [isOpen, setIsOpen] = useState(initial);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  return { isOpen, open, close, toggle };
}
