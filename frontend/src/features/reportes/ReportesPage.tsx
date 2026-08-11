import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileBarChart, TrendingDown } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Skeleton,
  useToast,
} from '@/shared/ui';
import { queryKeys } from '@/shared/lib/queryKeys';
import { fechaCorta, hoyEnLima } from '@/shared/lib/datetime';
import { puede } from '@/config/navigation';
import { useRol } from '@/features/auth/store';
import { EstadoBadge } from '@/features/asistencias/components/EstadoBadge';
import { reportesApi, extraerFilas } from './api';
import { exportarExcel } from './exportarExcel';

/** Primer día del mes en curso: el periodo que casi siempre se quiere consultar. */
function inicioDeMes(): string {
  const hoy = hoyEnLima();
  return `${hoy.slice(0, 7)}-01`;
}

export default function ReportesPage() {
  const rol = useRol();
  const toast = useToast();

  const [desde, setDesde] = useState(inicioDeMes);
  const [hasta, setHasta] = useState(hoyEnLima);
  const [exportando, setExportando] = useState(false);

  /**
   * El reporte se carga solo.
   *
   * Antes la pantalla arrancaba vacía y exigía pulsar "Generar reporte" para
   * ver cualquier cosa; el botón de Excel ni siquiera existía hasta después.
   * Eran dos pasos para llegar a lo que casi siempre se busca: el mes en
   * curso. Ahora eso ya está en pantalla al entrar y los filtros sirven para
   * apartarse de ese caso, no para alcanzarlo.
   */
  const filtros = { desde, hasta };

  const reporteQuery = useQuery({
    queryKey: queryKeys.reportes.rango(filtros),
    queryFn: () => reportesApi.rango(filtros),
    staleTime: 2 * 60_000,
  });

  const rankingQuery = useQuery({
    queryKey: queryKeys.reportes.ranking(desde, hasta),
    queryFn: () => reportesApi.ranking(desde, hasta),
    staleTime: 2 * 60_000,
  });

  const { filas, total } = useMemo(
    () => (reporteQuery.data ? extraerFilas(reporteQuery.data) : { filas: [], total: 0 }),
    [reporteQuery.data]
  );

  const ranking = (rankingQuery.data ?? []).slice(0, 10);
  const rangoInvalido = desde > hasta;

  async function descargar() {
    if (filas.length === 0) return;
    setExportando(true);
    try {
      await exportarExcel(filas, desde, hasta);
      toast.success('Reporte descargado', `${filas.length} registros exportados`);
    } catch {
      toast.danger('No se pudo generar el archivo', 'Inténtalo de nuevo en unos segundos.');
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Reportes"
        description="Histórico de asistencia por periodo"
        actions={
          puede(rol, 'reportes.exportar') && (
            <Button
              variant="primary"
              onClick={() => void descargar()}
              loading={exportando}
              disabled={filas.length === 0 || reporteQuery.isLoading}
              icon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Exportar a Excel
            </Button>
          )
        }
      />

      <Card>
        <CardBody className="flex flex-col sm:flex-row sm:items-end gap-3">
          <Field htmlFor="reporte-desde" label="Desde" className="flex-1">
            <Input
              id="reporte-desde"
              type="date"
              value={desde}
              max={hoyEnLima()}
              onChange={(e) => setDesde(e.target.value)}
              className="h-9"
            />
          </Field>

          <Field
            htmlFor="reporte-hasta"
            label="Hasta"
            className="flex-1"
            error={rangoInvalido ? 'La fecha final es anterior a la inicial' : undefined}
          >
            <Input
              id="reporte-hasta"
              type="date"
              value={hasta}
              min={desde}
              max={hoyEnLima()}
              onChange={(e) => setHasta(e.target.value)}
              invalid={rangoInvalido}
              className="h-9"
            />
          </Field>

          <div className="flex gap-2 shrink-0">
            <Button
              variant="secondary"
              onClick={() => {
                setDesde(inicioDeMes());
                setHasta(hoyEnLima());
              }}
            >
              Mes actual
            </Button>
          </div>
        </CardBody>
      </Card>

      {ranking.length > 0 && (
        <Card>
          <CardHeader
            title="Mayor incidencia"
            description="Alumnas con más tardanzas en el periodo"
          />
          <ul className="divide-y divide-border">
            {ranking.map((fila, indice) => (
              <li key={fila.alumna_id ?? indice} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-xs font-medium text-content-subtle tabular-nums w-4 shrink-0">
                  {indice + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base text-content truncate">
                    {fila.apellidos}, {fila.nombres}
                  </p>
                  <p className="text-xs text-content-muted">
                    {fila.grado} &ldquo;{fila.seccion}&rdquo;
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {Number(fila.tardanzas) > 0 && (
                    <Badge tone="warning">{Number(fila.tardanzas)} tardanzas</Badge>
                  )}
                  {Number(fila.ausencias) > 0 && (
                    <Badge tone="danger">{Number(fila.ausencias)} ausencias</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Detalle"
          actions={
            !reporteQuery.isLoading && (
              <span className="text-xs text-content-muted tabular-nums">
                {total} {total === 1 ? 'registro' : 'registros'}
              </span>
            )
          }
        />

        {reporteQuery.isError ? (
          <ErrorState
            title="No se pudo cargar el reporte"
            message={
              reporteQuery.error instanceof Error ? reporteQuery.error.message : undefined
            }
            onRetry={() => void reporteQuery.refetch()}
          />
        ) : reporteQuery.isLoading ? (
          <div className="p-4 flex flex-col gap-2">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : filas.length === 0 ? (
          <EmptyState
            icon={FileBarChart}
            title="Sin registros en este periodo"
            description="Prueba a ampliar el rango de fechas."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <caption className="sr-only">
                Asistencias registradas entre {desde} y {hasta}
              </caption>
              <thead>
                <tr className="bg-surface-sunken border-b border-border">
                  <th scope="col" className="text-left font-medium text-2xs uppercase tracking-wide text-content-muted px-4 py-2">
                    Alumna
                  </th>
                  <th scope="col" className="hidden sm:table-cell text-left font-medium text-2xs uppercase tracking-wide text-content-muted px-4 py-2">
                    Sección
                  </th>
                  <th scope="col" className="text-left font-medium text-2xs uppercase tracking-wide text-content-muted px-4 py-2">
                    Fecha
                  </th>
                  <th scope="col" className="text-left font-medium text-2xs uppercase tracking-wide text-content-muted px-4 py-2">
                    Estado
                  </th>
                  <th scope="col" className="hidden sm:table-cell text-right font-medium text-2xs uppercase tracking-wide text-content-muted px-4 py-2">
                    Hora
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filas.map((fila, indice) => (
                  <tr
                    key={`${fila.alumna_id ?? indice}-${fila.fecha}`}
                    className="hover:bg-surface-hover transition-colors"
                  >
                    <td className="px-4 py-2.5 text-content">
                      {fila.apellidos}, {fila.nombres}
                    </td>
                    <td className="hidden sm:table-cell px-4 py-2.5 text-content-secondary whitespace-nowrap">
                      {fila.grado} &ldquo;{fila.seccion}&rdquo;
                    </td>
                    <td className="px-4 py-2.5 text-content-secondary whitespace-nowrap tabular-nums">
                      {fechaCorta(fila.fecha)}
                    </td>
                    <td className="px-4 py-2.5">
                      <EstadoBadge estado={fila.estado} />
                    </td>
                    <td className="hidden sm:table-cell px-4 py-2.5 text-right text-content-muted tabular-nums">
                      {fila.hora ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {rankingQuery.isError && (
        <p className="flex items-center gap-2 text-sm text-content-muted">
          <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
          No se pudo cargar el ranking de incidencias.
        </p>
      )}
    </div>
  );
}
