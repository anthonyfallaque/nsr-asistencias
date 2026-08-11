import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { hora } from '@/shared/lib/datetime';
import { queryKeys } from '@/shared/lib/queryKeys';
import { porcentajeAsistencia, toneDePorcentaje } from '@/shared/domain/asistencia';
import { EmptyState, ErrorState, SkeletonRows } from '@/shared/ui';
import { UserRound } from 'lucide-react';
import { asistenciasApi, type ResumenSeccion, type AsistenciaAlumna } from '../api';
import { EstadoBadge } from './EstadoBadge';

const BARRA_TONE = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-border-strong',
  accent: 'bg-accent',
  brand: 'bg-brand',
  info: 'bg-info',
} as const;

function FilaAlumna({ alumna }: { alumna: AsistenciaAlumna }) {
  const inicial = alumna.apellidos.charAt(0).toUpperCase();

  return (
    <li className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors">
      <div className="h-7 w-7 rounded-md bg-surface-sunken border border-border flex items-center justify-center shrink-0">
        <span className="text-2xs font-semibold text-content-secondary">{inicial}</span>
      </div>

      <p className="flex-1 min-w-0 text-base text-content truncate">
        {alumna.apellidos}, {alumna.nombres}
      </p>

      <span className="hidden sm:block text-sm text-content-muted tabular-nums w-11 text-right">
        {hora(alumna.hora_escaneo)}
      </span>

      <div className="w-24 flex justify-end shrink-0">
        <EstadoBadge estado={alumna.estado} />
      </div>
    </li>
  );
}

/**
 * Sección plegable con el detalle de sus alumnas.
 *
 * La lista se consulta solo al desplegar (`enabled: abierto`). Con 27
 * secciones, cargarlas todas de golpe supondría 27 peticiones para mostrar
 * un dato que casi nunca se mira entero.
 */
export function SeccionCard({ resumen, fecha }: { resumen: ResumenSeccion; fecha: string }) {
  const [abierto, setAbierto] = useState(false);
  const panelId = useId();

  const pct = porcentajeAsistencia(resumen);
  const tone = toneDePorcentaje(pct);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.asistencias.seccion(resumen.seccion_id, fecha),
    queryFn: () => asistenciasApi.porSeccion(resumen.seccion_id, fecha),
    enabled: abierto,
  });

  const alumnas = data ?? [];

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls={panelId}
        className={cn(
          'w-full flex items-center gap-4 px-4 py-3 text-left',
          'hover:bg-surface-hover transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset'
        )}
      >
        <ChevronDown
          className={cn(
            'h-4 w-4 text-content-subtle shrink-0 transition-transform duration-base',
            abierto && 'rotate-180'
          )}
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          <p className="text-base font-medium text-content">
            {resumen.grado} &ldquo;{resumen.seccion}&rdquo;
          </p>
          <p className="text-xs text-content-muted">
            {resumen.total} {Number(resumen.total) === 1 ? 'alumna' : 'alumnas'}
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <div className="w-28 h-1.5 rounded-full bg-surface-sunken overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-slow',
                BARRA_TONE[tone]
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <span className="text-base font-semibold text-content tabular-nums w-11 text-right shrink-0">
          {pct}%
        </span>
      </button>

      {abierto && (
        <div id={panelId} className="border-t border-border">
          {isError ? (
            <ErrorState
              title="No se pudo cargar la sección"
              onRetry={() => void refetch()}
              className="py-8"
            />
          ) : isLoading ? (
            <SkeletonRows rows={4} />
          ) : alumnas.length === 0 ? (
            <EmptyState
              icon={UserRound}
              size="sm"
              title="Sin registros para esta fecha"
              description="Los estados aparecerán conforme se escaneen los códigos."
            />
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-2 bg-surface-sunken border-b border-border">
                <span className="w-7 shrink-0" aria-hidden="true" />
                <span className="flex-1 text-2xs font-medium text-content-muted uppercase tracking-wide">
                  Alumna
                </span>
                <span className="hidden sm:block w-11 text-right text-2xs font-medium text-content-muted uppercase tracking-wide">
                  Hora
                </span>
                <span className="w-24 text-right text-2xs font-medium text-content-muted uppercase tracking-wide">
                  Estado
                </span>
              </div>
              <ul className="divide-y divide-border">
                {alumnas.map((alumna) => (
                  <FilaAlumna key={alumna.id} alumna={alumna} />
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
