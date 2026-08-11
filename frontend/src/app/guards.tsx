import { Navigate, useLocation } from 'react-router-dom';
import { useEstaAutenticado, useUsuario } from '@/features/auth/store';
import { puede, rutaInicial, type Capacidad } from '@/config/navigation';

/**
 * Exige sesión iniciada.
 *
 * Guarda la ruta pedida en el estado de navegación para devolver al usuario
 * exactamente donde iba tras identificarse. Sin esto, quien abre un enlace
 * directo a un reporte acaba en el dashboard y tiene que volver a navegar.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const autenticado = useEstaAutenticado();
  const location = useLocation();

  if (!autenticado) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

/**
 * Exige una capacidad concreta.
 *
 * Se comprueba por capacidad y no por rol para que los permisos vivan en un
 * único mapa (`config/navigation.ts`). Antes cada ruta llevaba su propio
 * array de roles y añadir uno nuevo obligaba a repasar seis sitios.
 */
export function RequireCapacidad({
  capacidad,
  children,
}: {
  capacidad: Capacidad;
  children: React.ReactNode;
}) {
  const usuario = useUsuario();

  if (!puede(usuario?.rol, capacidad)) {
    return <Navigate to={rutaInicial(usuario?.rol)} replace />;
  }

  return <>{children}</>;
}
