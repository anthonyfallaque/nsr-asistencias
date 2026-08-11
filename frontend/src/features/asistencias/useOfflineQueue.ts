import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/shared/lib/http';
import { asistenciasApi, type EscaneoOffline } from './api';

const CLAVE = 'nsr-cola-escaneos';

/** Tope de seguridad: si la cola crece más, algo va mal y no debe comerse el almacenamiento. */
const MAX_COLA = 2000;

function leerCola(): EscaneoOffline[] {
  try {
    const crudo = localStorage.getItem(CLAVE);
    const valor: unknown = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(valor) ? (valor as EscaneoOffline[]) : [];
  } catch {
    return [];
  }
}

function guardarCola(cola: EscaneoOffline[]): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(cola));
  } catch {
    // Cuota agotada: preferible perder el guardado que romper el escaneo.
  }
}

/**
 * Cola de escaneos pendientes de enviar.
 *
 * Dos cambios respecto a la versión anterior, ambos por pérdida real de datos:
 *
 *  1. **Se encola también cuando el servidor rechaza.** Antes solo se
 *     encolaba si el navegador estaba sin red, así que un 429 —o un 500—
 *     descartaba el escaneo en silencio. Con ~800 alumnas por mañana y un
 *     límite de 200 peticiones, eso significaba cientos de asistencias
 *     perdidas sin que nadie se enterase.
 *
 *  2. **La sincronización es por elemento.** Antes un único registro
 *     malformado hacía fallar el lote completo y la cola quedaba atascada
 *     reintentando lo mismo para siempre. Ahora solo se conserva lo que el
 *     servidor no aceptó.
 */
export function useOfflineQueue() {
  const [cola, setCola] = useState<EscaneoOffline[]>(leerCola);
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);
  const [sincronizando, setSincronizando] = useState(false);
  const sincronizandoRef = useRef(false);

  const encolar = useCallback((escaneo: EscaneoOffline) => {
    setCola((actual) => {
      if (actual.length >= MAX_COLA) return actual;
      const siguiente = [...actual, escaneo];
      guardarCola(siguiente);
      return siguiente;
    });
  }, []);

  const sincronizar = useCallback(async (): Promise<void> => {
    // El guard va en una ref, no en el estado: dos disparos en el mismo
    // ciclo (volver la red y pulsar el botón) leerían el mismo valor
    // obsoleto del estado y enviarían la cola dos veces.
    if (sincronizandoRef.current) return;

    const pendientes = leerCola();
    if (pendientes.length === 0) return;

    sincronizandoRef.current = true;
    setSincronizando(true);

    try {
      const { resultados } = await asistenciasApi.sincronizarOffline(pendientes);

      // Se conserva solo lo que el servidor no aceptó, por índice.
      const rechazados = new Set(resultados.filter((r) => !r.ok).map((r) => r.indice));
      const restantes = pendientes.filter((_, i) => rechazados.has(i));

      setCola(restantes);
      guardarCola(restantes);
    } catch (error) {
      // Un fallo de red o de servidor no descarta nada: se reintenta luego.
      // Un 4xx distinto de 429 sí vacía la cola, porque reintentar algo que
      // el servidor considera inválido la bloquearía indefinidamente.
      if (error instanceof ApiError && !error.esReintentable && error.status !== 401) {
        setCola([]);
        guardarCola([]);
      }
    } finally {
      sincronizandoRef.current = false;
      setSincronizando(false);
    }
  }, []);

  /**
   * La sincronización se dispara desde el propio evento de reconexión, no
   * desde un efecto que observe `enLinea`.
   *
   * Enviar la cola es una reacción a un suceso del navegador, no un estado
   * derivado del render. Colgarlo de un efecto obligaba a silenciar dos
   * reglas de hooks y ataba el envío al ciclo de renderizado: si el
   * componente se re-renderizaba por otro motivo mientras volvía la red, la
   * condición podía evaluarse más de una vez.
   */
  useEffect(() => {
    const conectar = () => {
      setEnLinea(true);
      void sincronizar();
    };
    const desconectar = () => setEnLinea(false);

    window.addEventListener('online', conectar);
    window.addEventListener('offline', desconectar);
    return () => {
      window.removeEventListener('online', conectar);
      window.removeEventListener('offline', desconectar);
    };
  }, [sincronizar]);

  return {
    encolar,
    sincronizar,
    enLinea,
    sincronizando,
    pendientes: cola.length,
  };
}
