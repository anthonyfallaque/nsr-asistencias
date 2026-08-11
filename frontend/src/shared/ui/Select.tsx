import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

/**
 * Desplegable sobre `<select>` nativo.
 *
 * Deliberadamente no es un combobox a medida: el nativo trae navegación por
 * teclado, búsqueda por escritura y —en móvil— el selector del sistema, que
 * es más rápido y accesible que cualquier reimplementación. Solo se sustituye
 * la flecha, porque la del sistema no admite estilo.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, children, disabled, ...props },
  ref
) {
  return (
    <div className="relative flex items-center">
      <select
        ref={ref}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          'w-full h-8 bg-surface text-content text-base rounded-md',
          'border border-border',
          'pl-2.5 pr-8 appearance-none cursor-pointer',
          'transition-shadow duration-fast ease-out',
          'focus:outline-none focus:border-accent focus:shadow-focus',
          'disabled:bg-surface-sunken disabled:text-content-subtle disabled:cursor-not-allowed',
          invalid && 'border-danger focus:border-danger',
          className
        )}
        {...props}
      >
        {children}
      </select>

      <ChevronDown
        className="absolute right-2.5 h-3.5 w-3.5 text-content-subtle pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
});
