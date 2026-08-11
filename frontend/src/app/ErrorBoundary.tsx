import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/shared/ui';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Última red de seguridad ante un error de renderizado.
 *
 * Sin ella, cualquier excepción no capturada en un componente desmonta el
 * árbol entero y deja una pantalla en blanco, sin explicación ni salida —el
 * peor resultado posible para quien está usando el sistema en la puerta del
 * colegio a las siete de la mañana.
 *
 * Sigue siendo una clase porque React no ofrece equivalente en hooks.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Punto de enganche para un servicio de telemetría cuando exista.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-canvas">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-content">Algo se rompió</h1>
          <p className="text-base text-content-secondary mt-2">
            La aplicación encontró un error inesperado. Puedes recargar para volver a empezar;
            tus datos no se han perdido.
          </p>

          {import.meta.env.DEV && (
            <pre className="mt-4 text-left text-xs bg-surface-sunken border border-border rounded-md p-3 overflow-x-auto text-danger">
              {error.message}
            </pre>
          )}

          <Button
            variant="primary"
            size="lg"
            className="mt-5"
            onClick={() => window.location.reload()}
          >
            Recargar la aplicación
          </Button>
        </div>
      </div>
    );
  }
}
