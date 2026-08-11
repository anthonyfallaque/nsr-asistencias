import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth, useUsuario } from '@/features/auth/store';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';

function iniciales(nombre: string): string {
  return (
    nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((palabra) => palabra[0] ?? '')
      .join('')
      .toUpperCase() || '?'
  );
}

function nombreCorto(nombre: string): string {
  return nombre.split(' ').filter(Boolean).slice(0, 2).join(' ');
}

/**
 * Armazón de la aplicación autenticada.
 *
 * En escritorio, barra lateral fija; en móvil, barra superior mínima más
 * navegación inferior al alcance del pulgar. El contenido se limita a un
 * ancho máximo porque una tabla estirada a 2560 px obliga a recorrer la
 * pantalla con la mirada para relacionar la primera columna con la última.
 */
export function Layout() {
  const usuario = useUsuario();
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();

  function cerrarSesion() {
    logout();
    navigate('/login', { replace: true });
  }

  const nombre = usuario?.nombre ?? '';

  return (
    <div className="min-h-screen flex bg-canvas">
      <Sidebar
        rol={usuario?.rol}
        nombre={nombreCorto(nombre)}
        iniciales={iniciales(nombre)}
        onLogout={cerrarSesion}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-sticky h-topbar shrink-0 bg-surface border-b border-border flex items-center justify-between px-4">
          <div className="flex items-center gap-2 min-w-0">
            <img src="/logo.png" alt="" className="h-6 w-6 rounded object-contain shrink-0" />
            <span className="text-base font-semibold text-content truncate">Asistencias</span>
          </div>
          <div
            className="h-7 w-7 rounded-full bg-accent-soft border border-accent-border flex items-center justify-center shrink-0"
            title={nombre}
          >
            <span className="text-2xs font-semibold text-accent">{iniciales(nombre)}</span>
          </div>
        </header>

        {/* pb-20 en móvil deja sitio a la barra inferior; sin él, la última
            fila de cualquier lista queda tapada y parece que no existe. */}
        <main className="flex-1 px-4 py-5 pb-24 md:px-6 md:pb-8">
          <div className="mx-auto w-full max-w-content">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav rol={usuario?.rol} />
    </div>
  );
}
