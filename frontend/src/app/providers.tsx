import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/shared/lib/http';
import { ToastProvider } from '@/shared/ui';

/**
 * Proveedores globales.
 *
 * El QueryClient se crea dentro de estado en lugar de a nivel de módulo para
 * que cada montaje del árbol tenga el suyo: a nivel de módulo, la caché
 * sobrevive entre tests y entre recargas en caliente, y arrastra datos de
 * una sesión a la siguiente.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            // Reintentar un 401 o un 404 solo retrasa el mensaje de error.
            // Solo se reintenta lo que puede resolverse solo: red y 5xx.
            retry: (fallos, error) => {
              if (error instanceof ApiError) {
                return error.esReintentable && fallos < 2;
              }
              return fallos < 2;
            },
            retryDelay: (intento) => Math.min(1000 * 2 ** intento, 8000),
            refetchOnWindowFocus: true,
          },
          mutations: {
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
