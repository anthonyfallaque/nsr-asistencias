import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Skeleton } from '@/shared/ui';

export interface KpiCardProps {
  label: string;
  value: number;
  /** Contexto bajo la cifra: porcentaje, comparación, unidad. */
  sub?: string;
  icon: LucideIcon;
  loading?: boolean;
  /** Franja de color a la izquierda. Solo para las tarjetas que exigen atención. */
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}

const TONE_BAR = {
  neutral: 'bg-border-strong',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
} as const;

/**
 * Indicador numérico.
 *
 * La cifra domina en tamaño y peso; la etiqueta y el contexto quedan por
 * debajo en jerarquía. Es lo que permite leer los cuatro valores de un
 * vistazo sin detenerse a interpretar cada tarjeta.
 */
export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  loading = false,
  tone = 'neutral',
}: KpiCardProps) {
  return (
    <div className="relative bg-surface border border-border rounded-lg p-4 overflow-hidden">
      <span
        className={cn('absolute left-0 inset-y-0 w-0.5', TONE_BAR[tone])}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-content-muted">{label}</p>
        <Icon className="h-4 w-4 text-content-subtle shrink-0" aria-hidden="true" />
      </div>

      {loading ? (
        <Skeleton className="h-7 w-16 mt-2" />
      ) : (
        <p className="text-2xl font-semibold text-content mt-1.5" data-numeric>
          {value}
        </p>
      )}

      {loading ? (
        <Skeleton className="h-3 w-24 mt-2" />
      ) : (
        sub && <p className="text-xs text-content-muted mt-1">{sub}</p>
      )}
    </div>
  );
}
