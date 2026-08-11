import { useEffect, useState } from 'react';

/**
 * Retrasa la propagación de un valor hasta que deja de cambiar durante
 * `delay` milisegundos.
 *
 * En el buscador de alumnas la clave de consulta incluía el texto escrito,
 * de modo que cada pulsación disparaba una petición HTTP: escribir
 * "Rodríguez" generaba nueve. Con esto se genera una.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
