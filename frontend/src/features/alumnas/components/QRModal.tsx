import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Button, ErrorState, Modal, Skeleton } from '@/shared/ui';
import { queryKeys } from '@/shared/lib/queryKeys';
import { alumnasApi, type Alumna } from '../api';

export function QRModal({ alumna, onClose }: { alumna: Alumna | null; onClose: () => void }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.alumnas.qr(alumna?.id ?? ''),
    queryFn: () => alumnasApi.qr(alumna!.id),
    enabled: alumna !== null,
    // El QR de una alumna no cambia: una vez cargado, no hay motivo para repetirlo.
    staleTime: Infinity,
  });

  function descargar() {
    if (!data || !alumna) return;
    const enlace = document.createElement('a');
    enlace.href = data.qr_image;
    enlace.download = `QR_${alumna.apellidos}_${alumna.nombres}`.replace(/\s+/g, '_') + '.png';
    enlace.click();
  }

  return (
    <Modal
      open={alumna !== null}
      onClose={onClose}
      title={alumna ? `${alumna.apellidos}, ${alumna.nombres}` : ''}
      description={alumna ? `${alumna.grado} "${alumna.seccion}"` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            variant="primary"
            onClick={descargar}
            disabled={!data}
            icon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            Descargar
          </Button>
        </>
      }
    >
      <div className="flex justify-center py-2">
        {isError ? (
          <ErrorState
            title="No se pudo generar el código"
            onRetry={() => void refetch()}
            className="py-4"
          />
        ) : isLoading ? (
          <Skeleton className="h-52 w-52 rounded-lg" />
        ) : (
          <img
            src={data?.qr_image}
            alt={`Código QR de ${alumna?.apellidos}, ${alumna?.nombres}`}
            className="h-52 w-52 rounded-lg border border-border"
          />
        )}
      </div>
    </Modal>
  );
}
