import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

/**
 * Los tonos son semánticos, nunca decorativos: `success` significa "esto va
 * bien", no "esto es verde". Cuando el dominio cambie de colores, cambian
 * los tokens y ninguna pantalla se toca.
 */
const TONES = {
  neutral: 'bg-surface-sunken text-content-secondary border-border',
  accent: 'bg-accent-soft text-accent border-accent-border',
  brand: 'bg-brand-soft text-brand border-brand-border',
  success: 'bg-success-soft text-success border-success-border',
  warning: 'bg-warning-soft text-warning border-warning-border',
  danger: 'bg-danger-soft text-danger border-danger-border',
  info: 'bg-info-soft text-info border-info-border',
} as const;

export type BadgeTone = keyof typeof TONES;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Punto de color a la izquierda. Refuerza el estado sin depender del color solo. */
  dot?: boolean;
  icon?: ReactNode;
}

export function Badge({
  tone = 'neutral',
  dot = false,
  icon,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border rounded-full',
        'px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONES[tone],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current shrink-0"
          aria-hidden="true"
        />
      )}
      {icon}
      {children}
    </span>
  );
}
