import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { desdeFechaISO, esHoy, fechaCorta } from '@/shared/lib/datetime';
import { porcentajeAsistencia } from '@/shared/domain/asistencia';
import { EmptyState } from '@/shared/ui';
import { CalendarRange } from 'lucide-react';
import type { TendenciaDia } from '../api';

const ALTO = 96;

interface DiaCalculado {
  dia: TendenciaDia;
  pct: number;
  lectivo: boolean;
  hoy: boolean;
}

/**
 * Un sábado no es un día con 0 % de asistencia: es un día sin clases.
 *
 * El backend genera la serie con `generate_series` sobre días naturales, de
 * modo que fines de semana y feriados aparecen como ausencia total. Sin este
 * filtro, dos de cada siete barras son ruido y hunden la lectura de la
 * semana. Se detecta en el cliente a partir de la fecha; cuando el backend
 * tenga tabla de días lectivos, esta heurística se sustituye por ese dato
 * (los feriados siguen sin detectarse aquí).
 */
function esFinDeSemana(fecha: string): boolean {
  const dia = desdeFechaISO(fecha).getDay();
  return dia === 0 || dia === 6;
}

function colorDePct(pct: number): string {
  if (pct >= 90) return 'var(--color-success)';
  if (pct >= 75) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

export function TendenciaChart({ datos }: { datos: TendenciaDia[] }) {
  const [activo, setActivo] = useState<number | null>(null);

  const dias: DiaCalculado[] = datos.map((dia) => ({
    dia,
    pct: porcentajeAsistencia(dia),
    lectivo: !esFinDeSemana(dia.fecha) && Number(dia.total) > 0,
    hoy: esHoy(dia.fecha),
  }));

  const lectivos = dias.filter((d) => d.lectivo);

  if (lectivos.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        size="sm"
        title="Sin días lectivos en el periodo"
        description="Aún no hay registros que representar."
      />
    );
  }

  const promedio = Math.round(
    lectivos.reduce((suma, d) => suma + d.pct, 0) / lectivos.length
  );

  const detalle = activo !== null ? dias[activo] : undefined;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <p className="text-sm text-content-muted">
          Promedio del periodo{' '}
          <span className="font-semibold text-content tabular-nums">{promedio}%</span>
        </p>
        {detalle?.lectivo && (
          <p className="text-xs text-content-muted tabular-nums">
            {fechaCorta(detalle.dia.fecha)} · {detalle.dia.puntuales} puntuales ·{' '}
            {detalle.dia.tardanzas} tardanzas · {detalle.dia.ausentes} ausentes
          </p>
        )}
      </div>

      <div className="relative pt-4" style={{ height: ALTO + 34 }}>
        {[90, 75].map((referencia) => (
          <div
            key={referencia}
            className="absolute inset-x-0 flex items-center gap-2 pointer-events-none"
            style={{ bottom: 34 + (referencia * ALTO) / 100 }}
          >
            <div className="flex-1 border-t border-dashed border-border" />
            <span className="text-2xs text-content-muted tabular-nums w-7 text-right">
              {referencia}%
            </span>
          </div>
        ))}

        <ul className="flex items-end gap-1.5 pr-9" style={{ height: ALTO }}>
          {dias.map((d, i) => {
            const alto = d.lectivo ? Math.max((d.pct * ALTO) / 100, 3) : 0;

            return (
              <li key={d.dia.fecha} className="flex-1 flex items-end h-full">
                {d.lectivo ? (
                  <button
                    type="button"
                    onMouseEnter={() => setActivo(i)}
                    onMouseLeave={() => setActivo(null)}
                    onFocus={() => setActivo(i)}
                    onBlur={() => setActivo(null)}
                    aria-label={`${fechaCorta(d.dia.fecha)}: ${d.pct}% de asistencia, ${d.dia.puntuales} puntuales, ${d.dia.tardanzas} tardanzas, ${d.dia.ausentes} ausentes`}
                    className={cn(
                      'w-full rounded-t-sm transition-opacity duration-fast',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      activo !== null && activo !== i && 'opacity-40'
                    )}
                    style={{
                      height: alto,
                      background: d.hoy ? 'var(--color-accent)' : colorDePct(d.pct),
                    }}
                  />
                ) : (
                  // Los días sin clase se marcan con una banda tenue: comunican
                  // "aquí no hubo actividad" sin fingir un dato que no existe.
                  <div
                    className="w-full h-1 rounded-full bg-border"
                    aria-hidden="true"
                    title="Sin clases"
                  />
                )}
              </li>
            );
          })}
        </ul>

        <ul className="flex gap-1.5 pr-9 mt-2">
          {dias.map((d, i) => (
            <li key={d.dia.fecha} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
              <span
                className={cn(
                  'text-2xs tabular-nums font-medium',
                  !d.lectivo && 'text-content-muted',
                  d.lectivo && activo === i && 'text-content',
                  d.lectivo && activo !== i && 'text-content-muted'
                )}
              >
                {d.lectivo ? `${d.pct}%` : '—'}
              </span>
              <span
                className={cn(
                  'text-2xs truncate w-full text-center',
                  d.hoy ? 'text-accent font-semibold' : 'text-content-muted'
                )}
              >
                {d.hoy ? 'Hoy' : d.dia.dia}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
