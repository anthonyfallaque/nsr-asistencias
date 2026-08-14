import { cn } from '@/shared/lib/cn';
import { Sheet } from '@/shared/ui';
import { ACCIONES_USUARIO, type IdAccionUsuario } from '@/config/userMenu';
import { ROL_LABEL, type Rol } from '@/config/navigation';

export interface UserMenuProps {
  open: boolean;
  onClose: () => void;
  nombre: string;
  email: string;
  rol: Rol | undefined;
  iniciales: string;
  onAccion: (id: IdAccionUsuario) => void;
}

/**
 * Menú de usuario en móvil.
 *
 * Encabezado con la identidad y debajo las acciones. Mostrar quién eres no
 * es adorno: en un colegio el mismo dispositivo pasa por varias manos —el
 * móvil de la puerta, la tablet de secretaría—, y antes de cerrar sesión
 * conviene ver qué cuenta se está cerrando.
 */
export function UserMenu({
  open,
  onClose,
  nombre,
  email,
  rol,
  iniciales,
  onAccion,
}: UserMenuProps) {
  function ejecutar(id: IdAccionUsuario) {
    // Se cierra antes de actuar para que la hoja no se quede montada sobre
    // el diálogo que algunas acciones abren a continuación.
    onClose();
    onAccion(id);
  }

  return (
    <Sheet open={open} onClose={onClose} title="Cuenta" titleHidden>
      <div className="flex items-center gap-3 px-4 pt-1 pb-4 border-b border-border">
        <div className="h-10 w-10 rounded-full bg-accent-soft border border-accent-border flex items-center justify-center shrink-0">
          <span className="text-sm font-semibold text-accent">{iniciales}</span>
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-content truncate">{nombre}</p>
          <p className="text-sm text-content-muted truncate">{email}</p>
          {rol && <p className="text-xs text-content-muted mt-0.5">{ROL_LABEL[rol]}</p>}
        </div>
      </div>

      <ul className="py-1.5">
        {ACCIONES_USUARIO.map((accion) => {
          const Icon = accion.icon;
          const peligro = accion.tono === 'peligro';

          return (
            <li key={accion.id}>
              {accion.separarAntes && (
                <span className="block h-px bg-border my-1.5" aria-hidden="true" />
              )}
              <button
                type="button"
                onClick={() => ejecutar(accion.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left text-base',
                  'transition-colors active:bg-surface-active',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
                  peligro
                    ? 'text-danger hover:bg-danger-soft'
                    : 'text-content hover:bg-surface-hover'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {accion.label}
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
