import { CheckCircle2, Clock, XCircle, FileText, RotateCcw } from 'lucide-react';
import type { BadgeTone } from '@/shared/ui';

export type EstadoAsistencia = 'puntual' | 'tardanza' | 'ausente' | 'justificada';

/** Respuesta del escáner: incluye el caso "ya estaba registrada", que no es un estado almacenado. */
export type ResultadoEscaneo = EstadoAsistencia | 'ya_registrada';

interface EstadoConfig {
  label: string;
  tone: BadgeTone;
  icon: typeof CheckCircle2;
  /** Color literal para SVG (gráficos), donde no se pueden aplicar clases de Tailwind. */
  color: string;
}

/**
 * Definición única de los estados de asistencia.
 *
 * Antes vivía por triplicado: el dashboard tenía su mapa, los reportes otro
 * y el escáner un tercero —este último aún con emojis (✓ ⚠ ↩ ✕) que el
 * resto ya había abandonado—. Tres verdades sobre el mismo concepto del
 * dominio garantizan que tarde o temprano diverjan, y habían divergido.
 *
 * Cualquier pantalla que muestre un estado lo lee de aquí.
 */
export const ESTADOS: Record<EstadoAsistencia, EstadoConfig> = {
  puntual: {
    label: 'Puntual',
    tone: 'success',
    icon: CheckCircle2,
    color: 'var(--color-success)',
  },
  tardanza: {
    label: 'Tardanza',
    tone: 'warning',
    icon: Clock,
    color: 'var(--color-warning)',
  },
  justificada: {
    label: 'Justificada',
    tone: 'info',
    icon: FileText,
    color: 'var(--color-info)',
  },
  ausente: {
    label: 'Ausente',
    tone: 'danger',
    icon: XCircle,
    color: 'var(--color-danger)',
  },
};

/** Orden canónico de presentación: de mejor a peor. Leyendas y gráficos lo respetan. */
export const ORDEN_ESTADOS: EstadoAsistencia[] = [
  'puntual',
  'tardanza',
  'justificada',
  'ausente',
];

export const ESTADO_YA_REGISTRADA = {
  label: 'Ya registrada',
  tone: 'neutral' as BadgeTone,
  icon: RotateCcw,
  color: 'var(--color-text-muted)',
};

/** Normaliza lo que llegue de la API. Un estado ausente se representa como fila sin registro. */
export function normalizarEstado(valor: string | null | undefined): EstadoAsistencia {
  if (valor === 'puntual' || valor === 'tardanza' || valor === 'justificada') {
    return valor;
  }
  return 'ausente';
}

/**
 * Porcentaje de asistencia efectiva.
 *
 * Una justificada cuenta como asistencia a efectos de este indicador: la
 * alumna no está en clase, pero la falta está respaldada y no debe penalizar
 * la métrica de la sección.
 */
export function porcentajeAsistencia(datos: {
  total: number;
  puntuales: number;
  tardanzas: number;
  justificadas: number;
}): number {
  const total = Number(datos.total);
  if (total <= 0) return 0;
  const presentes =
    Number(datos.puntuales) + Number(datos.tardanzas) + Number(datos.justificadas);
  return Math.round((presentes / total) * 100);
}

/** Umbrales para colorear el porcentaje. Alinea el criterio en todas las pantallas. */
export function toneDePorcentaje(pct: number): BadgeTone {
  if (pct >= 90) return 'success';
  if (pct >= 75) return 'warning';
  return 'danger';
}
