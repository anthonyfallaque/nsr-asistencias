import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

type ToastTone = 'success' | 'warning' | 'danger' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

const TONE_CONFIG: Record<
  ToastTone,
  { icon: typeof CheckCircle2; className: string; iconClass: string }
> = {
  success: { icon: CheckCircle2, className: 'border-success-border', iconClass: 'text-success' },
  warning: { icon: AlertTriangle, className: 'border-warning-border', iconClass: 'text-warning' },
  danger: { icon: XCircle, className: 'border-danger-border', iconClass: 'text-danger' },
  info: { icon: Info, className: 'border-info-border', iconClass: 'text-info' },
};

interface ToastApi {
  success: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  danger: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Notificaciones efímeras.
 *
 * El sistema anterior no confirmaba ninguna acción: registrar una alumna
 * cerraba el modal y no ocurría nada visible, así que el usuario no podía
 * distinguir "guardado" de "se perdió". Toda mutación debe pasar por aquí.
 *
 * La región es `aria-live="polite"`: se anuncia al terminar lo que el lector
 * esté leyendo, sin interrumpir. Los errores usan `role="alert"`, que sí
 * interrumpe, porque exigen atención inmediata.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, tone, title, description }]);
      // Los errores permanecen más tiempo: suelen requerir leer y actuar.
      const ttl = tone === 'danger' ? 7000 : 4000;
      setTimeout(() => dismiss(id), ttl);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, description) => push('success', title, description),
      warning: (title, description) => push('warning', title, description),
      danger: (title, description) => push('danger', title, description),
      info: (title, description) => push('info', title, description),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          className="fixed z-toast bottom-4 right-4 left-4 sm:left-auto flex flex-col gap-2 pointer-events-none safe-bottom"
          aria-live="polite"
          aria-atomic="false"
        >
          {toasts.map((toast) => {
            const { icon: Icon, className, iconClass } = TONE_CONFIG[toast.tone];
            return (
              <div
                key={toast.id}
                role={toast.tone === 'danger' ? 'alert' : 'status'}
                className={cn(
                  'pointer-events-auto flex items-start gap-2.5 w-full sm:w-80',
                  'bg-surface border rounded-lg shadow-lg px-3.5 py-3',
                  'animate-toast-in',
                  className
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', iconClass)} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium text-content">{toast.title}</p>
                  {toast.description && (
                    <p className="text-sm text-content-muted mt-0.5">{toast.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Descartar notificación"
                  className="shrink-0 -mr-1 -mt-0.5 p-1 rounded-sm text-content-subtle hover:text-content hover:bg-surface-hover transition-colors"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe usarse dentro de <ToastProvider>');
  }
  return context;
}
