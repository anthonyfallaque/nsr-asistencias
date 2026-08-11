import { useQueries } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { Button, Modal, Skeleton } from '@/shared/ui';
import { queryKeys } from '@/shared/lib/queryKeys';
import { alumnasApi, type Alumna } from '../api';

/**
 * Impresión de carnets por lote.
 *
 * Antes, obtener los códigos de una sección de 40 alumnas exigía abrir el
 * modal de cada una, esperar, descargar y repetir: unos doscientos clics
 * para una tarea que el colegio hace al empezar el curso. Aquí se piden
 * todos a la vez y se imprimen en una hoja.
 *
 * La cuadrícula usa medidas en milímetros porque el resultado se recorta a
 * mano: en píxeles, el tamaño físico dependería del navegador y de la
 * resolución, y los carnets saldrían de distinto tamaño en cada equipo.
 */
export function CarnetsModal({
  alumnas,
  open,
  onClose,
}: {
  alumnas: Alumna[];
  open: boolean;
  onClose: () => void;
}) {
  const consultas = useQueries({
    queries: alumnas.map((alumna) => ({
      queryKey: queryKeys.alumnas.qr(alumna.id),
      queryFn: () => alumnasApi.qr(alumna.id),
      enabled: open,
      staleTime: Infinity,
    })),
  });

  const listas = consultas.filter((c) => c.data).length;
  const cargando = consultas.some((c) => c.isLoading);
  const progreso = alumnas.length > 0 ? Math.round((listas / alumnas.length) * 100) : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Carnets para imprimir"
      description={`${alumnas.length} alumnas · se imprimen 8 por hoja A4`}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            variant="primary"
            onClick={() => window.print()}
            disabled={cargando}
            icon={<Printer className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            {cargando ? `Preparando ${progreso}%` : 'Imprimir'}
          </Button>
        </>
      }
    >
      <div id="hoja-carnets" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {alumnas.map((alumna, indice) => {
          const qr = consultas[indice]?.data;

          return (
            <div
              key={alumna.id}
              className="carnet flex flex-col items-center gap-1.5 border border-border rounded-md p-2.5 bg-surface break-inside-avoid"
            >
              {qr ? (
                <img src={qr.qr_image} alt="" className="w-full aspect-square object-contain" />
              ) : (
                <Skeleton className="w-full aspect-square rounded-sm" />
              )}

              <p className="text-2xs font-semibold text-content text-center leading-tight w-full truncate">
                {alumna.apellidos}
              </p>
              <p className="text-2xs text-content-secondary text-center leading-tight w-full truncate -mt-1">
                {alumna.nombres}
              </p>
              <p className="text-2xs text-content-muted">
                {alumna.grado} &quot;{alumna.seccion}&quot;
              </p>
            </div>
          );
        })}
      </div>

      {/* Al imprimir solo debe salir la hoja de carnets: sin la interfaz de la
          aplicación alrededor ni el fondo oscurecido del modal. */}
      <style>{`
        @media print {
          body > *:not([data-print-root]) { display: none !important; }
          [data-print-root] { position: static !important; }
          [data-print-root] [role="dialog"] {
            position: static !important;
            max-height: none !important;
            border: none !important;
            box-shadow: none !important;
          }
          [data-print-root] [role="dialog"] > div:not(:nth-child(2)) { display: none !important; }
          #hoja-carnets {
            display: grid !important;
            grid-template-columns: repeat(4, 45mm) !important;
            gap: 4mm !important;
          }
          .carnet { break-inside: avoid; page-break-inside: avoid; }
          @page { size: A4 portrait; margin: 10mm; }
        }
      `}</style>
    </Modal>
  );
}
