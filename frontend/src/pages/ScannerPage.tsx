import { useState, useCallback, useRef } from 'react';
import QRScanner from '../components/QRScanner';
import { asistencias as asistenciasApi } from '../services/api';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import type { ResultadoEscaneo } from '../types';

type FeedbackType = 'puntual' | 'tardanza' | 'ya_registrada' | 'error' | 'offline';

interface Feedback {
  type: FeedbackType;
  resultado?: ResultadoEscaneo;
  mensaje?: string;
}

const COOLDOWN_MS = 2800;

const CONFIG: Record<FeedbackType, { bg: string; border: string; icon: string; label: string }> = {
  puntual:       { bg: 'bg-emerald-600', border: 'border-emerald-500', icon: '✓', label: 'Puntual' },
  tardanza:      { bg: 'bg-amber-500',   border: 'border-amber-400',   icon: '⚠', label: 'Tardanza' },
  ya_registrada: { bg: 'bg-nsr-navy',    border: 'border-blue-400',    icon: '↩', label: 'Ya registrada' },
  error:         { bg: 'bg-nsr-wine',    border: 'border-red-400',     icon: '✕', label: 'Error' },
  offline:       { bg: 'bg-gray-700',    border: 'border-gray-500',    icon: '📴', label: 'Sin conexión' },
};

export default function ScannerPage() {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [scanning, setScanning] = useState(true);
  const lastScanRef    = useRef('');
  const lastScanTimeRef = useRef(0);
  const { enqueue, isOnline, pendientes, sync, syncing } = useOfflineQueue();

  const handleScan = useCallback(async (token: string) => {
    const now = Date.now();
    if (token === lastScanRef.current && now - lastScanTimeRef.current < COOLDOWN_MS) return;
    lastScanRef.current    = token;
    lastScanTimeRef.current = now;
    setScanning(false);

    if (!isOnline) {
      enqueue({ qr_token: token, scanned_at: new Date().toISOString() });
      setFeedback({ type: 'offline', mensaje: 'Guardado — se enviará cuando haya conexión' });
      setTimeout(() => { setScanning(true); setFeedback(null); }, COOLDOWN_MS);
      return;
    }

    try {
      const resultado = await asistenciasApi.escanear(token);
      const type: FeedbackType =
        resultado.estado === 'ya_registrada' ? 'ya_registrada' :
        resultado.estado as FeedbackType;
      setFeedback({ type, resultado });
    } catch (err) {
      setFeedback({ type: 'error', mensaje: err instanceof Error ? err.message : 'QR no reconocido' });
    }

    setTimeout(() => { setScanning(true); setFeedback(null); }, COOLDOWN_MS);
  }, [isOnline, enqueue]);

  const cfg = feedback ? CONFIG[feedback.type] : null;

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto">

      {/* Estado de conexión */}
      <div className={`flex items-center justify-between px-4 py-2.5 rounded-2xl text-sm font-medium ${
        isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
      }`}>
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
            isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
          }`} />
          {isOnline ? 'Conectado' : 'Sin conexión — modo offline'}
        </span>
        {pendientes > 0 && (
          <button
            onClick={sync}
            disabled={syncing}
            className="text-xs underline font-semibold"
          >
            {syncing ? 'Sincronizando...' : `Sync (${pendientes})`}
          </button>
        )}
      </div>

      {/* Área de cámara + resultado */}
      <div className={`rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 ${
        cfg ? cfg.bg : 'bg-nsr-navy'
      }`}>

        {/* Cámara */}
        <div className="relative p-3 pb-0">
          <QRScanner onScan={handleScan} active={scanning} />

          {/* Marco guía */}
          <div className="pointer-events-none absolute inset-3 flex items-center justify-center">
            <div className="w-52 h-52 relative">
              {/* Esquinas del marco */}
              {[
                'top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl',
                'top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl',
                'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl',
                'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl',
              ].map((cls, i) => (
                <div key={i} className={`absolute w-8 h-8 border-white/80 ${cls}`} />
              ))}
            </div>
          </div>
        </div>

        {/* Panel de resultado */}
        <div className="px-5 py-5 min-h-[130px] flex flex-col justify-center">
          {!feedback && (
            <div className="text-center text-white">
              <p className="font-semibold text-lg">Apunta al código QR</p>
              <p className="text-white/60 text-sm mt-1">Mantén la tarjeta dentro del marco</p>
            </div>
          )}

          {feedback?.type === 'error' && (
            <div className="text-center text-white">
              <p className="text-3xl mb-1">{cfg?.icon}</p>
              <p className="font-semibold">{feedback.mensaje}</p>
            </div>
          )}

          {feedback?.type === 'offline' && (
            <div className="text-center text-white">
              <p className="text-3xl mb-2">{cfg?.icon}</p>
              <p className="font-semibold">{feedback.mensaje}</p>
            </div>
          )}

          {feedback?.resultado && (
            <div className="flex items-center gap-4">
              {/* Foto / Avatar */}
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/20 flex-shrink-0 border-2 border-white/30">
                {feedback.resultado.alumna.foto_url ? (
                  <img src={feedback.resultado.alumna.foto_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/60">
                    <svg className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-base leading-tight">
                  {feedback.resultado.alumna.apellidos},
                </p>
                <p className="font-bold text-white text-base leading-tight truncate">
                  {feedback.resultado.alumna.nombres}
                </p>
                <p className="text-white/70 text-xs mt-1">
                  {feedback.resultado.alumna.grado} &quot;{feedback.resultado.alumna.seccion}&quot;
                </p>
                <div className="mt-2 inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1">
                  <span className="text-white font-bold text-sm">{cfg?.icon}</span>
                  <span className="text-white font-semibold text-sm">{cfg?.label}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hora actual */}
      <div className="text-center">
        <p className="text-2xl font-bold text-nsr-navy tabular-nums">
          {new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
        <p className="text-gray-400 text-xs mt-0.5 capitalize">
          {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>
    </div>
  );
}
