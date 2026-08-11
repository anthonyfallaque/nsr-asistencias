import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, LogOut } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui';
import { navParaRol, ROL_LABEL, type Rol } from '@/config/navigation';

function Logo({ size = 28 }: { size?: number }) {
  const [falló, setFalló] = useState(false);

  if (falló) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-md bg-accent flex items-center justify-center shrink-0"
      >
        <span className="text-accent-fg font-bold text-2xs tracking-tight">NSR</span>
      </div>
    );
  }

  return (
    <img
      src="/logo.png"
      alt=""
      onError={() => setFalló(true)}
      style={{ width: size, height: size }}
      className="rounded-md object-contain shrink-0"
    />
  );
}

export interface SidebarProps {
  rol: Rol | undefined;
  nombre: string;
  iniciales: string;
  onLogout: () => void;
}

/**
 * Navegación lateral de escritorio.
 *
 * Superficie clara con un borde de 1px, no un bloque de color: el azul
 * institucional se reserva para el elemento activo, de modo que la vista
 * señale dónde estás en vez de competir con el contenido. Es la diferencia
 * entre una barra que informa y una que decora.
 *
 * El estado plegado persiste en localStorage: en pantallas pequeñas el
 * usuario lo pliega una vez y no debería tener que repetirlo cada mañana.
 */
export function Sidebar({ rol, nombre, iniciales, onLogout }: SidebarProps) {
  const [expandido, setExpandido] = useState(
    () => localStorage.getItem('nsr-sidebar') !== 'collapsed'
  );

  const items = navParaRol(rol);

  function alternar() {
    setExpandido((valor) => {
      localStorage.setItem('nsr-sidebar', valor ? 'collapsed' : 'expanded');
      return !valor;
    });
  }

  return (
    <aside
      aria-label="Navegación principal"
      className={cn(
        'hidden md:flex flex-col shrink-0 bg-surface border-r border-border',
        'sticky top-0 h-screen transition-[width] duration-base ease-out',
        expandido ? 'w-sidebar' : 'w-sidebar-collapsed'
      )}
    >
      <div
        className={cn(
          'flex items-center h-topbar border-b border-border shrink-0',
          expandido ? 'gap-2.5 px-3' : 'justify-center px-2'
        )}
      >
        <Logo />
        {expandido && (
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-content leading-tight truncate">
              Asistencias
            </p>
            <p className="text-2xs text-content-muted leading-tight truncate">
              N. S. del Rosario
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  title={!expandido ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center rounded-md text-base transition-colors duration-fast',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      expandido ? 'gap-2.5 px-2.5 py-2' : 'justify-center p-2',
                      isActive
                        ? 'bg-accent-soft text-accent font-medium'
                        : 'text-content-secondary hover:bg-surface-hover hover:text-content'
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {expandido && <span className="truncate">{item.label}</span>}
                  {!expandido && <span className="sr-only">{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-2 shrink-0">
        <div
          className={cn(
            'flex items-center rounded-md',
            expandido ? 'gap-2.5 px-2.5 py-2' : 'justify-center py-2'
          )}
        >
          <div
            className="h-7 w-7 rounded-full bg-accent-soft border border-accent-border flex items-center justify-center shrink-0"
            title={!expandido ? nombre : undefined}
          >
            <span className="text-2xs font-semibold text-accent">{iniciales}</span>
          </div>
          {expandido && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-content truncate leading-tight">{nombre}</p>
              <p className="text-2xs text-content-muted truncate">
                {rol ? ROL_LABEL[rol] : ''}
              </p>
            </div>
          )}
        </div>

        <div className={cn('flex mt-1', expandido ? 'gap-1' : 'flex-col gap-1 items-center')}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            iconOnly={!expandido}
            aria-label={!expandido ? 'Cerrar sesión' : undefined}
            icon={<LogOut className="h-3.5 w-3.5" aria-hidden="true" />}
            className={cn(expandido && 'flex-1 justify-start')}
          >
            Cerrar sesión
          </Button>

          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={alternar}
            aria-label={expandido ? 'Plegar la navegación' : 'Desplegar la navegación'}
            aria-expanded={expandido}
            icon={
              expandido ? (
                <PanelLeftClose className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden="true" />
              )
            }
          />
        </div>
      </div>
    </aside>
  );
}
