import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { CameraOff } from 'lucide-react';

const ELEMENTO_ID = 'lector-qr';

export interface QRScannerProps {
  onScan: (token: string) => void;
  activo: boolean;
}

/**
 * Lector de códigos QR sobre la cámara trasera.
 *
 * `onScan` se guarda en una ref y no se declara como dependencia del efecto:
 * si la página recrea el manejador en cada render —lo habitual—, incluirlo
 * reiniciaría la cámara continuamente, con su parpadeo y su medio segundo
 * de arranque en cada ciclo.
 */
export function QRScanner({ onScan, activo }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const iniciadoRef = useRef(false);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let cancelado = false;

    async function iniciar() {
      if (iniciadoRef.current || !activo) return;

      try {
        const scanner = new Html5Qrcode(ELEMENTO_ID);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
          (texto) => onScanRef.current(texto.trim()),
          undefined
        );

        if (cancelado) {
          await scanner.stop().catch(() => undefined);
          return;
        }

        iniciadoRef.current = true;
        setError(null);
      } catch {
        setError(
          'No se pudo abrir la cámara. Revisa que el navegador tenga permiso para usarla.'
        );
      }
    }

    async function detener() {
      if (!iniciadoRef.current || !scannerRef.current) return;
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // Detener una cámara ya detenida lanza; no aporta nada propagarlo.
      }
      iniciadoRef.current = false;
      scannerRef.current = null;
    }

    if (activo) {
      void iniciar();
    } else {
      void detener();
    }

    return () => {
      cancelado = true;
      void detener();
    };
  }, [activo]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 aspect-square bg-surface-sunken rounded-lg border border-border p-6 text-center">
        <CameraOff className="h-6 w-6 text-content-subtle" aria-hidden="true" />
        <p className="text-sm text-content-secondary max-w-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div id={ELEMENTO_ID} className="w-full overflow-hidden rounded-lg bg-content" />

      {/* Marco guía. Es puramente visual: el lector analiza todo el fotograma. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-52 w-52">
          {[
            'top-0 left-0 border-t-2 border-l-2 rounded-tl-lg',
            'top-0 right-0 border-t-2 border-r-2 rounded-tr-lg',
            'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg',
            'bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg',
          ].map((posicion) => (
            <span
              key={posicion}
              className={`absolute h-7 w-7 border-white/90 ${posicion}`}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
