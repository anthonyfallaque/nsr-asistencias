import { ESTADOS, ORDEN_ESTADOS, type EstadoAsistencia } from '@/shared/domain/asistencia';

export interface DonutChartProps {
  datos: Record<EstadoAsistencia, number>;
  size?: number;
}

const GROSOR = 10;

/**
 * Anillo de distribución del día.
 *
 * Dibujado con `stroke-dasharray` sobre un único círculo en lugar de arcos
 * con `path`: evita la aritmética de coordenadas polares y, sobre todo,
 * elimina las costuras de un píxel que aparecen entre segmentos adyacentes
 * cuando cada arco se traza por separado.
 *
 * El total va en el centro porque es el dato que se busca primero; los
 * segmentos responden "de qué se compone".
 */
export function DonutChart({ datos, size = 132 }: DonutChartProps) {
  const total = ORDEN_ESTADOS.reduce((suma, estado) => suma + (datos[estado] || 0), 0);

  const radio = (size - GROSOR) / 2;
  const circunferencia = 2 * Math.PI * radio;

  let acumulado = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={
          total === 0
            ? 'Sin registros para esta fecha'
            : `Distribución de ${total} alumnas: ` +
              ORDEN_ESTADOS.filter((e) => datos[e] > 0)
                .map((e) => `${datos[e]} ${ESTADOS[e].label.toLowerCase()}`)
                .join(', ')
        }
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radio}
          fill="none"
          stroke="var(--color-surface-sunken)"
          strokeWidth={GROSOR}
        />

        {total > 0 &&
          ORDEN_ESTADOS.map((estado) => {
            const valor = datos[estado] || 0;
            if (valor === 0) return null;

            const porcion = valor / total;
            const longitud = porcion * circunferencia;
            const desfase = acumulado * circunferencia;
            acumulado += porcion;

            return (
              <circle
                key={estado}
                cx={size / 2}
                cy={size / 2}
                r={radio}
                fill="none"
                stroke={ESTADOS[estado].color}
                strokeWidth={GROSOR}
                strokeDasharray={`${longitud} ${circunferencia - longitud}`}
                strokeDashoffset={-desfase}
                // -90° coloca el origen arriba; por defecto empezaría a las 3 en punto.
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                strokeLinecap="butt"
              />
            );
          })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-semibold text-content leading-none" data-numeric>
          {total}
        </span>
        <span className="text-2xs text-content-muted mt-1">alumnas</span>
      </div>
    </div>
  );
}

/** Leyenda del anillo, con los valores alineados en columna. */
export function DonutLegend({ datos }: { datos: Record<EstadoAsistencia, number> }) {
  const total = ORDEN_ESTADOS.reduce((suma, estado) => suma + (datos[estado] || 0), 0);

  return (
    <ul className="flex flex-col gap-2.5 flex-1 min-w-0">
      {ORDEN_ESTADOS.map((estado) => {
        const valor = datos[estado] || 0;
        const pct = total > 0 ? Math.round((valor / total) * 100) : 0;

        return (
          <li key={estado} className="flex items-center gap-2.5">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ background: ESTADOS[estado].color }}
              aria-hidden="true"
            />
            <span className="text-sm text-content-secondary flex-1 truncate">
              {ESTADOS[estado].label}
            </span>
            <span className="text-sm font-medium text-content tabular-nums">{valor}</span>
            <span className="text-xs text-content-muted tabular-nums w-9 text-right">
              {pct}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}
