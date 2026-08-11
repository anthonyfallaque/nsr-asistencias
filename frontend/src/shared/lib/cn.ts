import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Compone clases de Tailwind resolviendo conflictos por especificidad de
 * utilidad, no por orden en el archivo.
 *
 * Sin esto, `cn('px-4', props.className)` con `className="px-2"` produce
 * `"px-4 px-2"` y gana la que Tailwind haya emitido más tarde en el CSS —
 * es decir, el resultado depende del orden de compilación y no del de uso.
 * `twMerge` descarta la anterior y deja `px-2`, que es lo que quien llama
 * espera. Es la condición para que los componentes acepten `className` sin
 * volverse impredecibles.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
