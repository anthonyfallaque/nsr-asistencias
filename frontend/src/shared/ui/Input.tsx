import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Icono decorativo a la izquierda. No sustituye a la etiqueta. */
  icon?: ReactNode;
  /** Contenido a la derecha: botón de mostrar contraseña, unidad, atajo. */
  addonRight?: ReactNode;
  invalid?: boolean;
}

/**
 * Campo de texto.
 *
 * El foco se dibuja con `shadow-focus` en vez del contorno global, para que
 * el anillo abrace el borde redondeado del control en lugar de trazar un
 * rectángulo por fuera.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon, addonRight, invalid, className, disabled, ...props },
  ref
) {
  return (
    <div className="relative flex items-center">
      {icon && (
        <span
          className="absolute left-2.5 flex items-center text-content-subtle pointer-events-none"
          aria-hidden="true"
        >
          {icon}
        </span>
      )}

      <input
        ref={ref}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          'w-full h-8 bg-surface text-content text-base rounded-md',
          'border border-border',
          'placeholder:text-content-subtle',
          'transition-shadow duration-fast ease-out',
          'focus:outline-none focus:border-accent focus:shadow-focus',
          'disabled:bg-surface-sunken disabled:text-content-subtle disabled:cursor-not-allowed',
          icon ? 'pl-8' : 'pl-2.5',
          addonRight ? 'pr-9' : 'pr-2.5',
          invalid && 'border-danger focus:border-danger focus:shadow-[0_0_0_3px_var(--color-danger-soft)]',
          className
        )}
        {...props}
      />

      {addonRight && (
        <span className="absolute right-1 flex items-center">{addonRight}</span>
      )}
    </div>
  );
});
