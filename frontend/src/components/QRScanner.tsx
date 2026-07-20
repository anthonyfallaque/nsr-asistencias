import { useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface Props {
  onScan: (token: string) => void;
  active: boolean;
}

const SCANNER_ID = 'qr-reader';

export default function QRScanner({ onScan, active }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startedRef = useRef(false);

  const start = useCallback(async () => {
    if (startedRef.current) return;
    try {
      const scanner = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' }, // cámara trasera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          onScan(decodedText.trim());
        },
        undefined
      );
      startedRef.current = true;
    } catch (err) {
      console.error('Error iniciando escáner:', err);
    }
  }, [onScan]);

  const stop = useCallback(async () => {
    if (!startedRef.current || !scannerRef.current) return;
    try {
      await scannerRef.current.stop();
      scannerRef.current.clear();
    } catch {
      // ignorar errores al detener
    }
    startedRef.current = false;
    scannerRef.current = null;
  }, []);

  useEffect(() => {
    if (active) {
      start();
    } else {
      stop();
    }
    return () => { stop(); };
  }, [active, start, stop]);

  return (
    <div className="relative">
      <div
        id={SCANNER_ID}
        className="w-full rounded-xl overflow-hidden"
        style={{ minHeight: '280px' }}
      />
      {/* Marco visual */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="w-56 h-56 border-4 border-white rounded-2xl shadow-lg opacity-80" />
      </div>
    </div>
  );
}
