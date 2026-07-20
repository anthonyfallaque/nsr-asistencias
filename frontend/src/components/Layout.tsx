import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import BottomNav from './BottomNav';
import type { Rol } from '../types';

const navItems = [
  { to: '/scanner',   label: 'Escáner QR',  roles: ['portero', 'admin', 'auxiliar'] as Rol[] },
  { to: '/dashboard', label: 'Dashboard',   roles: ['auxiliar', 'tutora', 'directora', 'admin'] as Rol[] },
  { to: '/alumnas',   label: 'Alumnas',     roles: ['admin', 'auxiliar', 'directora'] as Rol[] },
  { to: '/reportes',  label: 'Reportes',    roles: ['auxiliar', 'tutora', 'directora', 'admin'] as Rol[] },
];

const ROL_LABEL: Record<string, string> = {
  admin:     'Administrador',
  portero:   'Portero',
  auxiliar:  'Auxiliar',
  tutora:    'Tutora',
  directora: 'Directora',
};

function LogoNSR() {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div className="w-10 h-10 rounded-full bg-nsr-wine flex items-center justify-center border-2 border-white/25 flex-shrink-0">
        <span className="text-white font-bold text-xs tracking-tight">NSR</span>
      </div>
    );
  }
  return (
    <img
      src="/logo.png"
      alt="NSR"
      className="w-10 h-10 rounded-full object-contain bg-white p-0.5 border-2 border-white/25 flex-shrink-0"
      onError={() => setError(true)}
    />
  );
}

export default function Layout() {
  const { usuario, logout } = useAuth();
  const navigate  = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function handleLogout() {
    setOpen(false);
    logout();
    navigate('/login');
  }

  const visible  = navItems.filter(i => usuario && i.roles.includes(usuario.rol));
  const iniciales = usuario?.nombre.split(' ').slice(0, 2).map(w => w[0]).join('') ?? '?';
  const rolLabel  = ROL_LABEL[usuario?.rol ?? ''] ?? (usuario?.rol ?? '');
  const firstName = usuario?.nombre.split(' ').filter(Boolean)[0] ?? '';

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="bg-nsr-navy text-white shadow-lg sticky top-0 z-30">

        {/* Barra principal */}
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">

          {/* Logo + nombre institución */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <LogoNSR />
            <div className="min-w-0 leading-tight">
              <p className="font-bold text-sm hidden sm:block truncate">Nuestra Señora del Rosario</p>
              <p className="text-blue-300/80 text-xs hidden sm:block">Sistema de Asistencias · Chiclayo</p>
              <p className="font-bold text-[13px] block sm:hidden">NSR · Asistencias</p>
            </div>
          </div>

          {/* Menú de usuario */}
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              onClick={() => setOpen(v => !v)}
              aria-haspopup="true"
              aria-expanded={open}
              className={`flex items-center gap-2 rounded-xl transition-colors px-2 py-1.5 ${
                open ? 'bg-white/15' : 'hover:bg-white/10 active:bg-white/15'
              }`}
            >
              {/* Avatar circular */}
              <div className="w-8 h-8 rounded-full bg-nsr-wine flex items-center justify-center border-2 border-nsr-wine-mid flex-shrink-0">
                <span className="text-white text-xs font-bold tracking-wide">{iniciales}</span>
              </div>
              {/* Nombre + rol (solo desktop) */}
              <div className="hidden md:block text-left leading-tight">
                <p className="text-[13px] font-semibold text-white">{firstName}</p>
                <p className="text-xs text-blue-300">{rolLabel}</p>
              </div>
              {/* Chevron (solo desktop) */}
              <svg
                className={`w-3.5 h-3.5 text-blue-300/80 hidden md:block transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown */}
            {open && (
              <div
                className="absolute right-0 top-[calc(100%+8px)] w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
                style={{ animation: 'dropIn 0.14s ease-out' }}
              >
                <div className="p-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors text-sm font-semibold"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nav escritorio (segunda fila) */}
        {visible.length > 1 && (
          <div className="hidden md:block border-t border-white/10">
            <div className="max-w-6xl mx-auto px-4 flex">
              {visible.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `px-5 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                      isActive
                        ? 'text-white border-nsr-wine'
                        : 'text-blue-200 border-transparent hover:text-white hover:border-white/30'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ── Contenido ───────────────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-5 pb-24 md:pb-6">
        <Outlet />
      </main>

      {/* ── Bottom Nav (solo móvil) ──────────────────────────────────── */}
      <BottomNav />
    </div>
  );
}
