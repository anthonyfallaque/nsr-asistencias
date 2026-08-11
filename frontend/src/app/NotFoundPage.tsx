import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button, EmptyState } from '@/shared/ui';
import { useUsuario } from '@/features/auth/store';
import { rutaInicial } from '@/config/navigation';

/**
 * Ruta inexistente.
 *
 * Antes cualquier URL desconocida redirigía en silencio al inicio, así que
 * un enlace mal copiado parecía funcionar y el usuario no entendía por qué
 * había acabado en otra pantalla. Decirlo es más útil que disimularlo.
 */
export function NotFoundPage() {
  const usuario = useUsuario();
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <EmptyState
        icon={Compass}
        title="Esta página no existe"
        description="Puede que el enlace esté mal escrito o que la sección se haya movido."
        action={
          <Button variant="primary" onClick={() => navigate(rutaInicial(usuario?.rol))}>
            Volver al inicio
          </Button>
        }
      />
    </div>
  );
}
