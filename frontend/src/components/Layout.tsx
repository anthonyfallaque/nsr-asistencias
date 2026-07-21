import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import BottomNav from './BottomNav';
import type { Rol } from '../types';

// ─── Iconos del sidebar ───────────────────────────────────────────────────────

function IconQR() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/>
      <rect x="3" y="16" width="5" height="5" rx="1"/>
      <path d="M21 16h-3v3M21 21v.01M14 3v3M14 10h3v4M14 17v4M11 14h.01"/>
    </svg>
  );
}
function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5"/>
      <rect x="14" y="3" width="7" height="5" rx="1.5"/>
      <rect x="14" y="12" width="7" height="9" rx="1.5"/>
      <rect x="3" y="16" width="7" height="5" rx="1.5"/>
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
}
function IconReportes() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <line x1="10" y1="9"  x2="8" y2="9"/>
    </svg>
  );
}
function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
    </svg>
  );
}
function IconPanel() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <line x1="9" y1="3" x2="9" y2="21"/>
    </svg>
  );
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: '/scanner',   label: 'Escáner QR', roles: ['portero', 'admin', 'auxiliar']               as Rol[], icon: <IconQR /> },
  { to: '/dashboard', label: 'Dashboard',  roles: ['auxiliar', 'tutora', 'directora', 'admin']   as Rol[], icon: <IconDashboard /> },
  { to: '/alumnas',   label: 'Alumnas',    roles: ['admin', 'auxiliar', 'directora']             as Rol[], icon: <IconUsers /> },
  { to: '/reportes',  label: 'Reportes',   roles: ['auxiliar', 'tutora', 'directora', 'admin']   as Rol[], icon: <IconReportes /> },
];

const ROL_LABEL: Record<string, string> = {
  admin: 'Administrador', portero: 'Portero', auxiliar: 'Auxiliar',
  tutora: 'Tutora', directora: 'Directora',
};

// ─── Logo ─────────────────────────────────────────────────────────────────────

function LogoNSR({ size = 36 }: { size?: number }) {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div style={{ width: size, height: size }} className="rounded-full bg-nsr-wine flex items-center justify-center border-2 border-white/25 flex-shrink-0">
        <span className="text-white font-bold text-xs">NSR</span>
      </div>
    );
  }
  return (
    <img src="/logo.png" alt="NSR" onError={() => setError(true)}
      style={{ width: size, height: size }}
      className="rounded-full object-contain bg-white p-0.5 border-2 border-white/20 flex-shrink-0"
    />
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function Layout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  const visible   = NAV_ITEMS.filter(i => usuario && i.roles.includes(usuario.rol));
  const iniciales = usuario?.nombre.split(' ').slice(0, 2).map(w => w[0]).join('') ?? '?';
  const rolLabel  = ROL_LABEL[usuario?.rol ?? ''] ?? (usuario?.rol ?? '');
  const firstName = usuario?.nombre.split(' ').filter(Boolean).slice(0, 2).join(' ') ?? '';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex bg-gray-50">

      {/* ── Sidebar (solo desktop) ──────────────────────────────────────── */}
      <aside className={`hidden md:flex flex-col flex-shrink-0 bg-[#002147] transition-all duration-200 ${open ? 'w-56' : 'w-16'}`}
        style={{ position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>

        {/* Logo */}
        <div className={`flex items-center h-16 flex-shrink-0 border-b border-white/10 ${open ? 'gap-3 px-4' : 'justify-center px-0'}`}>
          <LogoNSR />
          {open && (
            <div className="min-w-0 leading-tight">
              <p className="font-bold text-white text-[13px] truncate">Nuestra Señora del Rosario</p>
              <p className="text-blue-300/70 text-[11px] truncate">Asistencias · Chiclayo</p>
            </div>
          )}
        </div>

        {/* Toggle */}
        <div className={`flex border-b border-white/10 py-1.5 ${open ? 'justify-end pr-2' : 'justify-center'}`}>
          <button onClick={() => setOpen(v => !v)} title={open ? 'Colapsar' : 'Expandir'}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <span className="w-4 h-4"><IconPanel /></span>
          </button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {visible.map(item => (
            <NavLink key={item.to} to={item.to}
              title={!open ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center rounded-xl transition-colors ${open ? 'gap-3 px-3 py-2.5' : 'justify-center p-2.5'} ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/55 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>
              {open && <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Usuario + logout */}
        <div className="border-t border-white/10 p-3 flex-shrink-0 space-y-1">
          {open ? (
            <>
              <div className="flex items-center gap-2.5 px-1 py-1">
                <div className="w-8 h-8 rounded-full bg-nsr-wine flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">{iniciales}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate leading-tight">{firstName}</p>
                  <p className="text-xs text-blue-300/80 truncate">{rolLabel}</p>
                </div>
              </div>
              <button onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-400/80 hover:bg-red-500/10 hover:text-red-300 transition-colors text-sm">
                <span className="w-4 h-4 flex-shrink-0"><IconLogout /></span>
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <div className="flex justify-center py-1">
                <div className="w-8 h-8 rounded-full bg-nsr-wine flex items-center justify-center" title={firstName}>
                  <span className="text-white text-xs font-bold">{iniciales}</span>
                </div>
              </div>
              <button onClick={handleLogout} title="Cerrar sesión"
                className="w-full flex justify-center p-2 rounded-xl text-red-400/80 hover:bg-red-500/10 hover:text-red-300 transition-colors">
                <span className="w-4 h-4"><IconLogout /></span>
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ── Área de contenido ──────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">

        {/* Top bar móvil */}
        <header className="md:hidden bg-[#002147] text-white h-14 flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-2.5 min-w-0">
            <LogoNSR size={32} />
            <span className="font-bold text-[13px] truncate">NSR · Asistencias</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-nsr-wine flex items-center justify-center flex-shrink-0" title={firstName}>
            <span className="text-white text-xs font-bold">{iniciales}</span>
          </div>
        </header>

        <main className="flex-1 px-5 py-5 pb-24 md:pb-6 overflow-y-auto">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Bottom nav móvil */}
      <BottomNav />
    </div>
  );
}
