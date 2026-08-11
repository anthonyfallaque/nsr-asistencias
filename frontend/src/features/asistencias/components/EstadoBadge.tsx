import { Badge } from '@/shared/ui';
import { ESTADOS, normalizarEstado } from '@/shared/domain/asistencia';

export interface EstadoBadgeProps {
  /**
   * Se acepta `string` suelto además del tipo del dominio porque la API
   * devuelve `null` para los días sin registro y, en reportes antiguos,
   * valores que ya no están en el enum. `normalizarEstado` los reconduce.
   */
  estado: string | null | undefined;
  /** Añade el icono del estado. Útil donde el color solo no basta. */
  conIcono?: boolean;
}

/**
 * Distintivo de estado de asistencia.
 *
 * Único punto donde un estado se convierte en algo visible. Antes esta
 * traducción estaba escrita tres veces —dashboard, reportes y escáner—, con
 * etiquetas y colores que ya no coincidían entre sí.
 */
export function EstadoBadge({ estado, conIcono = false }: EstadoBadgeProps) {
  const clave = normalizarEstado(typeof estado === 'string' ? estado : null);
  const config = ESTADOS[clave];
  const Icon = config.icon;

  return (
    <Badge
      tone={config.tone}
      icon={conIcono ? <Icon className="h-3 w-3" aria-hidden="true" /> : undefined}
      dot={!conIcono}
    >
      {config.label}
    </Badge>
  );
}
