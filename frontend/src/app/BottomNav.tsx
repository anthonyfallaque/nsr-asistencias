import { NavLink } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import { navParaRol, type Rol } from '@/config/navigation';

/**
 * Navegación inferior de móvil.
 *
 * Consume `navParaRol` igual que la barra lateral. Antes cada una tenía su
 * propia copia del menú, con los roles duplicados y los iconos ya
 * divergidos —el mismo destino se dibujaba distinto según el dispositivo—.
 *
 * Se oculta a partir de `md`, donde toma el relevo la barra lateral.
 */
export function BottomNav({ rol }: { rol: Rol | undefined }) {
  const items = navParaRol(rol);
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Navegación principal"
      className="md:hidden fixed bottom-0 inset-x-0 z-sticky bg-surface border-t border-border safe-bottom"
    >
      <ul className="flex">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'relative flex flex-col items-center justify-center gap-1 py-2',
                    'transition-colors duration-fast',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
                    isActive ? 'text-accent' : 'text-content-muted'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Marca superior: el estado activo no depende solo del color,
                        que es indistinguible para buena parte de los daltonismos. */}
                    <span
                      className={cn(
                        'absolute top-0 h-0.5 w-8 rounded-full transition-opacity',
                        isActive ? 'bg-accent opacity-100' : 'opacity-0'
                      )}
                      aria-hidden="true"
                    />
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    <span className="text-2xs font-medium">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
