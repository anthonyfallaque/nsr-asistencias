import { useCallback, useRef, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, UserRound, ScanLine } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Button, Card } from '@/shared/ui';
import { useReloj } from '@/shared/hooks/useReloj';
import { horaConSegundos, hora, fechaLarga, hoyEnLima } from '@/shared/lib/datetime';
import { ApiError } from '@/shared/lib/http';
import { ESTADOS, ESTADO_YA_REGISTRADA } from '@/shared/domain/asistencia';
import { asistenciasApi, type Escaneo } from './api';
import { QRScanner } from './components/QRScanner';
import { useOfflineQueue } from './useOfflineQueue';

/** Ventana en la que se ignora un token repetido, para que un QR sostenido no dispare en bucle. */
const ANTIRREBOTE_MS = 2500;

type Resultado =
  | { tipo: 'escaneo'; datos: Escaneo }
  | { tipo: 'encolado' }
  | { tipo: 'error'; mensaje: string };

function PanelResultado({ resultado }: { resultado: Resultado }) {
  if (resultado.tipo === 'encolado') {
    return (
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-lg bg-info-soft border border-info-border flex items-center justify-center shrink-0">
          <RefreshCw className="h-5 w-5 text-info" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-medium text-content">Guardado sin conexión</p>
          <p className="text-sm text-content-muted">
            Se enviará automáticamente al reconectar.
          </p>
        </div>
      </div>
    );
  }

  if (resultado.tipo === 'error') {
    return (
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-lg bg-danger-soft border border-danger-border flex items-center justify-center shrink-0">
          <ScanLine className="h-5 w-5 text-danger" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-medium text-content">No se pudo registrar</p>
          <p className="text-sm text-content-muted">{resultado.mensaje}</p>
        </div>
      </div>
    );
  }

  const { datos } = resultado;
  const config =
    datos.estado === 'ya_registrada'
      ? ESTADO_YA_REGISTRADA
      : (ESTADOS[datos.estado] ?? ESTADO_YA_REGISTRADA);
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3">
      <div className="h-11 w-11 rounded-lg bg-surface-sunken border border-border overflow-hidden shrink-0">
        {datos.alumna.foto_url ? (
          <img src={datos.alumna.foto_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <UserRound className="h-5 w-5 text-content-subtle" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-content truncate">
          {datos.alumna.apellidos}, {datos.alumna.nombres}
        </p>
        <p className="text-sm text-content-muted truncate">
          {datos.alumna.grado} &ldquo;{datos.alumna.seccion}&rdquo;
        </p>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className="inline-flex items-center gap-1.5 text-base font-semibold"
          style={{ color: config.color }}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {config.label}
        </span>
        <span className="text-sm text-content-muted tabular-nums">
          {hora(datos.hora_escaneo)}
        </span>
      </div>
    </div>
  );
}

export default function ScannerPage() {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [escaneando, setEscaneando] = useState(true);
  const ultimoToken = useRef('');
  const ultimoMomento = useRef(0);

  const ahora = useReloj();
  const { encolar, sincronizar, enLinea, sincronizando, pendientes } = useOfflineQueue();

  const alEscanear = useCallback(
    async (token: string) => {
      const momento = Date.now();
      if (token === ultimoToken.current && momento - ultimoMomento.current < ANTIRREBOTE_MS) {
        return;
      }
      ultimoToken.current = token;
      ultimoMomento.current = momento;
      setEscaneando(false);

      const guardarParaLuego = () => {
        encolar({ qr_token: token, scanned_at: new Date().toISOString() });
        setResultado({ tipo: 'encolado' });
      };

      if (!enLinea) {
        guardarParaLuego();
      } else {
        try {
          const datos = await asistenciasApi.escanear(token);
          setResultado({ tipo: 'escaneo', datos });
        } catch (error) {
          // Un rechazo del servidor por saturación o caída no puede
          // significar perder la asistencia: se guarda y se reintenta.
          // Solo se muestra error cuando el QR es realmente inválido.
          if (error instanceof ApiError && error.esReintentable) {
            guardarParaLuego();
          } else {
            setResultado({
              tipo: 'error',
              mensaje: error instanceof Error ? error.message : 'Código no reconocido',
            });
          }
        }
      }

      setTimeout(() => {
        setEscaneando(true);
        setResultado(null);
      }, ANTIRREBOTE_MS);
    },
    [enLinea, encolar]
  );

  return (
    <div className="mx-auto w-full max-w-md flex flex-col gap-4">
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-lg border px-3 py-2',
          enLinea
            ? 'bg-success-soft border-success-border'
            : 'bg-warning-soft border-warning-border'
        )}
      >
        <span
          className={cn(
            'flex items-center gap-2 text-sm font-medium',
            enLinea ? 'text-success' : 'text-warning'
          )}
        >
          {enLinea ? (
            <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {enLinea ? 'Conectado' : 'Sin conexión'}
        </span>

        {pendientes > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void sincronizar()}
            loading={sincronizando}
            disabled={!enLinea}
          >
            {sincronizando
              ? 'Enviando…'
              : `Enviar ${pendientes} pendiente${pendientes === 1 ? '' : 's'}`}
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        <QRScanner onScan={alEscanear} activo={escaneando} />

        {/* `aria-live` anuncia el resultado sin que el portero mire la pantalla:
            con el móvil en la mano y la fila avanzando, el audio es el canal real. */}
        <div
          className="border-t border-border px-4 py-3.5 min-h-[76px] flex items-center"
          aria-live="polite"
        >
          {resultado ? (
            <div className="w-full animate-fade-in">
              <PanelResultado resultado={resultado} />
            </div>
          ) : (
            <div className="w-full text-center">
              <p className="text-base font-medium text-content">Apunta al código QR</p>
              <p className="text-sm text-content-muted mt-0.5">
                Mantén la tarjeta dentro del marco
              </p>
            </div>
          )}
        </div>
      </Card>

      <div className="text-center">
        <p className="text-3xl font-semibold text-content tabular-nums leading-none">
          {horaConSegundos(ahora)}
        </p>
        <p className="text-sm text-content-muted mt-1.5 capitalize">
          {fechaLarga(hoyEnLima())}
        </p>
      </div>
    </div>
  );
}
