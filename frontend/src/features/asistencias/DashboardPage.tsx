import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, CheckCircle2, Clock, XCircle, LayoutGrid, RotateCw } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Skeleton,
} from '@/shared/ui';
import { queryKeys } from '@/shared/lib/queryKeys';
import { fechaLarga, hoyEnLima, esHoy } from '@/shared/lib/datetime';
import { porcentajeAsistencia, type EstadoAsistencia } from '@/shared/domain/asistencia';
import { asistenciasApi } from './api';
import { KpiCard } from './components/KpiCard';
import { DonutChart, DonutLegend } from './components/DonutChart';
import { TendenciaChart } from './components/TendenciaChart';
import { SeccionCard } from './components/SeccionCard';

export default function DashboardPage() {
  const [fecha, setFecha] = useState(hoyEnLima);
  const viendoHoy = esHoy(fecha);

  /**
   * El resumen se consulta CON la fecha seleccionada.
   *
   * Antes la clave era `['resumen']` y el endpoint resolvía siempre contra
   * una vista fijada a hoy, mientras que la lista de cada sección sí
   * respetaba la fecha. El resultado era una pantalla que mostraba los
   * totales de hoy junto al detalle de otro día, sin avisar de nada.
   */
  const resumenQuery = useQuery({
    queryKey: queryKeys.asistencias.resumen(fecha),
    queryFn: () => asistenciasApi.resumen(fecha),
    // Solo tiene sentido refrescar en vivo si se está mirando el día en curso.
    refetchInterval: viendoHoy ? 30_000 : false,
  });

  const tendenciaQuery = useQuery({
    queryKey: queryKeys.asistencias.tendencia(14),
    queryFn: () => asistenciasApi.tendencia(14),
    staleTime: 5 * 60_000,
  });

  const secciones = resumenQuery.data ?? [];

  const totales = useMemo(
    () =>
      secciones.reduce<Record<EstadoAsistencia, number> & { total: number }>(
        (acc, seccion) => ({
          total: acc.total + Number(seccion.total),
          puntual: acc.puntual + Number(seccion.puntuales),
          tardanza: acc.tardanza + Number(seccion.tardanzas),
          justificada: acc.justificada + Number(seccion.justificadas),
          ausente: acc.ausente + Number(seccion.ausentes),
        }),
        { total: 0, puntual: 0, tardanza: 0, justificada: 0, ausente: 0 }
      ),
    [secciones]
  );

  const pctGlobal = porcentajeAsistencia({
    total: totales.total,
    puntuales: totales.puntual,
    tardanzas: totales.tardanza,
    justificadas: totales.justificada,
  });

  const cargando = resumenQuery.isLoading;

  function proporcion(valor: number): string | undefined {
    if (totales.total === 0) return undefined;
    return `${Math.round((valor / totales.total) * 100)}% del total`;
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Asistencia del día"
        description={
          <span className="flex items-center gap-2 flex-wrap">
            <span className="capitalize">{fechaLarga(fecha)}</span>
            {viendoHoy && (
              <span className="inline-flex items-center gap-1.5 text-xs text-content-muted">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-success animate-pulse"
                  aria-hidden="true"
                />
                En vivo
              </span>
            )}
          </span>
        }
        actions={
          <>
            {!viendoHoy && (
              <Button variant="ghost" size="md" onClick={() => setFecha(hoyEnLima())}>
                Volver a hoy
              </Button>
            )}
            <Input
              type="date"
              value={fecha}
              max={hoyEnLima()}
              onChange={(e) => setFecha(e.target.value || hoyEnLima())}
              aria-label="Fecha a consultar"
              className="w-auto"
            />
            <Button
              variant="secondary"
              size="md"
              iconOnly
              onClick={() => void resumenQuery.refetch()}
              loading={resumenQuery.isFetching}
              aria-label="Actualizar los datos"
              icon={<RotateCw className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          </>
        }
      />

      {resumenQuery.isError ? (
        <Card>
          <ErrorState
            title="No se pudo cargar la asistencia"
            message={resumenQuery.error instanceof Error ? resumenQuery.error.message : undefined}
            onRetry={() => void resumenQuery.refetch()}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Total alumnas"
              value={totales.total}
              sub={totales.total > 0 ? `${pctGlobal}% de asistencia` : undefined}
              icon={Users}
              loading={cargando}
            />
            <KpiCard
              label="Puntuales"
              value={totales.puntual}
              sub={proporcion(totales.puntual)}
              icon={CheckCircle2}
              tone="success"
              loading={cargando}
            />
            <KpiCard
              label="Tardanzas"
              value={totales.tardanza}
              sub={proporcion(totales.tardanza)}
              icon={Clock}
              tone="warning"
              loading={cargando}
            />
            <KpiCard
              label="Ausentes"
              value={totales.ausente}
              sub={proporcion(totales.ausente)}
              icon={XCircle}
              tone="danger"
              loading={cargando}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader title="Distribución" description="Estados registrados en la fecha" />
              <CardBody>
                {cargando ? (
                  <div className="flex items-center gap-6">
                    <Skeleton className="h-[132px] w-[132px] rounded-full shrink-0" />
                    <div className="flex-1 flex flex-col gap-3">
                      {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-3 w-full" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-6">
                    <DonutChart datos={totales} />
                    <DonutLegend datos={totales} />
                  </div>
                )}
              </CardBody>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader
                title="Tendencia"
                description="Asistencia efectiva de los últimos días lectivos"
              />
              <CardBody>
                {tendenciaQuery.isLoading ? (
                  <Skeleton className="h-[130px] w-full" />
                ) : tendenciaQuery.isError ? (
                  <ErrorState
                    title="No se pudo cargar la tendencia"
                    onRetry={() => void tendenciaQuery.refetch()}
                    className="py-6"
                  />
                ) : (
                  <TendenciaChart datos={tendenciaQuery.data ?? []} />
                )}
              </CardBody>
            </Card>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-content">Por sección</h2>

            {cargando ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-[60px] w-full rounded-lg" />
                ))}
              </div>
            ) : secciones.length === 0 ? (
              <Card>
                <EmptyState
                  icon={LayoutGrid}
                  title="Sin datos para esta fecha"
                  description={
                    viendoHoy
                      ? 'Los registros aparecerán conforme se escaneen los códigos QR en la entrada.'
                      : 'No se registró asistencia en la fecha seleccionada.'
                  }
                />
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {secciones.map((seccion) => (
                  <SeccionCard key={seccion.seccion_id} resumen={seccion} fecha={fecha} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
