import { useState, useEffect, useCallback } from 'react';
import type { OfflineScan } from '../types';
import { asistencias as asistenciasApi } from '../services/api';

const STORAGE_KEY = 'offline_queue';

function loadQueue(): OfflineScan[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as OfflineScan[];
  } catch {
    return [];
  }
}

function saveQueue(q: OfflineScan[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
}

export function useOfflineQueue() {
  const [queue, setQueue] = useState<OfflineScan[]>(loadQueue);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Auto-sync cuando vuelve la conexión
  useEffect(() => {
    if (isOnline && queue.length > 0) {
      sync();
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  const enqueue = useCallback((scan: OfflineScan) => {
    setQueue(prev => {
      const next = [...prev, scan];
      saveQueue(next);
      return next;
    });
  }, []);

  const sync = useCallback(async () => {
    const current = loadQueue();
    if (current.length === 0 || syncing) return;

    setSyncing(true);
    try {
      await asistenciasApi.syncOffline(current);
      setQueue([]);
      saveQueue([]);
    } catch {
      // Mantener en cola, reintentar la próxima vez
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  return { queue, enqueue, sync, isOnline, syncing, pendientes: queue.length };
}
