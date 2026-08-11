import { useEffect, useState } from 'react';

/**
 * Hora actual, actualizada cada segundo.
 *
 * La pantalla del escáner mostraba `new Date()` evaluado en el render, sin
 * temporizador: marcaba la hora en que se abrió la página y ahí se quedaba.
 * En el punto de control donde la hora decide puntual o tardanza, un reloj
 * detenido es peor que no tener reloj.
 */
export function useReloj(intervaloMs = 1000): Date {
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);

  return ahora;
}
