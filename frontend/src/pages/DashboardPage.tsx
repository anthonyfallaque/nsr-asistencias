import { useState, useMemo, type FormEvent, type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { asistencias as asistenciasApi, alumnas as alumnasApi } from '../services/api';
import type { ResumenSeccion, AsistenciaAlumna, TendenciaDia, Seccion } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);

// ─────────────────────────────────────────────────────────────────────────────
// DONUT CHART — SVG puro, sin librerías
// ─────────────────────────────────────────────────────────────────────────────

function DonutChart({ puntuales, tardanzas, ausentes, justificadas }: {
  puntuales: number; tardanzas: number; ausentes: number; justificadas: number;
}) {
  const r = 52, cx = 68, cy = 68;
  const circ = 2 * Math.PI * r;
  const total = puntuales + tardanzas + ausentes + justificadas;
  const pct = total > 0 ? Math.round((puntuales + tardanzas + justificadas) / total * 100) : 0;

  // Orden: puntual (navy) → tardanza (amber) → justificada (purple) → ausente (red)
  const segs = [
    { value: puntuales,    color: '#002147' },
    { value: tardanzas,    color: '#D97706' },
    { value: justificadas, color: '#7C3AED' },
    { value: ausentes,     color: '#EF4444' },
  ];
  let cumulative = 0;

  return (
    <svg viewBox="0 0 136 136" width="136" height="136" style={{ flexShrink: 0 }}>
      {/* Track vacío */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={16} />
      {total > 0 && segs.map((seg, i) => {
        if (seg.value === 0) return null;
        const len = (seg.value / total) * circ;
        const offset = circ - cumulative;
        cumulative += len;
        return (
          <circle key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={seg.color} strokeWidth={16}
            strokeDasharray={`${len} ${circ}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
      })}
      {/* Texto central */}
      <text x={cx} y={62} textAnchor="middle" fontSize="26" fontWeight="800" fill="#002147">{pct}%</text>
      <text x={cx} y={80} textAnchor="middle" fontSize="9.5" fill="#9CA3AF" letterSpacing="0.5">ASISTENCIA HOY</text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TREND CHART — barras apiladas SVG, últimos 7 días
// ─────────────────────────────────────────────────────────────────────────────

function TrendChart({ data }: { data: TendenciaDia[] }) {
  if (!data.length) {
    return <div className="flex items-center justify-center h-32 text-gray-300 text-sm">Sin datos</div>;
  }

  const max = Math.max(...data.map(d => d.total), 1);
  const W = 380, H = 130, PAD_B = 24, PAD_T = 8;
  const chartH = H - PAD_B - PAD_T;
  const n = data.length;
  const barW = 32;
  const step = n > 1 ? (W - barW) / (n - 1) : W / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
      {/* Líneas de grilla */}
      {[0, 0.5, 1].map(f => (
        <line key={f}
          x1={0} y1={PAD_T + chartH * (1 - f)}
          x2={W} y2={PAD_T + chartH * (1 - f)}
          stroke="#E5E7EB" strokeWidth={f === 0 ? 1.5 : 1}
          strokeDasharray={f === 0 ? '' : '3 3'}
        />
      ))}

      {data.map((d, i) => {
        const x = i * step;
        const isToday = i === n - 1;
        const scale = chartH / max;
        // Alturas mínimas de 2px si hay valor > 0, para que se vea
        const hP = d.puntuales    > 0 ? Math.max(d.puntuales    * scale, 2) : 0;
        const hT = d.tardanzas    > 0 ? Math.max(d.tardanzas    * scale, 2) : 0;
        const hJ = d.justificadas > 0 ? Math.max(d.justificadas * scale, 2) : 0;
        const hA = d.ausentes     > 0 ? Math.max(d.ausentes     * scale, 2) : 0;
        const yBase = PAD_T + chartH;

        return (
          <g key={i}>
            {hA > 0 && <rect x={x} y={yBase - hP - hT - hJ - hA} width={barW} height={hA}
              fill={isToday ? '#FCA5A5' : '#FECACA'} rx="2" />}
            {hJ > 0 && <rect x={x} y={yBase - hP - hT - hJ} width={barW} height={hJ}
              fill={isToday ? '#C4B5FD' : '#DDD6FE'} rx="2" />}
            {hT > 0 && <rect x={x} y={yBase - hP - hT} width={barW} height={hT}
              fill={isToday ? '#FCD34D' : '#FDE68A'} rx="2" />}
            {hP > 0 && <rect x={x} y={yBase - hP} width={barW} height={hP}
              fill={isToday ? '#002147' : '#93C5FD'} rx="2" />}
            <text x={x + barW / 2} y={H - 5} textAnchor="middle" fontSize="9"
              fill={isToday ? '#002147' : '#9CA3AF'}
              fontWeight={isToday ? '700' : '400'}>
              {isToday ? 'Hoy' : d.dia}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI CARD
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, colorClass, bgClass, sub }: {
  label: string; value: number; icon: string;
  colorClass: string; bgClass: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">{label}</span>
        <span className={`w-8 h-8 rounded-xl ${bgClass} flex items-center justify-center text-base`}>{icon}</span>
      </div>
      <p className={`text-3xl font-black leading-none ${colorClass}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT ROW — con botones de marcado manual
// ─────────────────────────────────────────────────────────────────────────────

function StudentRow({ alumna, fecha, onMark, loading }: {
  alumna: AsistenciaAlumna;
  fecha: string;
  onMark: (alumna_id: string, estado: string, justificacion?: string) => void;
  loading: boolean;
}) {
  const [justMode, setJustMode] = useState(false);
  const [justText, setJustText] = useState(alumna.justificacion ?? '');
  const estado = (alumna.estado ?? 'ausente') as string;

  const btns = [
    { key: 'puntual',     icon: '✓', title: 'Puntual',    color: '#059669', bg: '#D1FAE5' },
    { key: 'tardanza',    icon: '⏱', title: 'Tardanza',   color: '#D97706', bg: '#FEF3C7' },
    { key: 'ausente',     icon: '✕', title: 'Ausente',    color: '#DC2626', bg: '#FEE2E2' },
    { key: 'justificada', icon: '~', title: 'Justificar', color: '#7C3AED', bg: '#EDE9FE' },
  ];

  return (
    <div className={`border-b border-gray-50 last:border-0 ${loading ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50/80 transition-colors">
        {/* Avatar inicial */}
        <div className="w-8 h-8 rounded-full flex-shrink-0 bg-nsr-navy/10 flex items-center justify-center text-xs font-bold text-nsr-navy select-none">
          {alumna.apellidos[0]}
        </div>

        {/* Nombre + hora */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate leading-tight">
            {alumna.apellidos}, {alumna.nombres}
          </p>
          {alumna.hora_escaneo && (
            <p className="text-[11px] text-gray-400 mt-0.5">
              {new Date(alumna.hora_escaneo).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {/* Badge estado actual */}
        {estado === 'puntual'    && <span className="badge-puntual    whitespace-nowrap hidden sm:inline-flex">Puntual</span>}
        {estado === 'tardanza'   && <span className="badge-tardanza   whitespace-nowrap hidden sm:inline-flex">Tardanza</span>}
        {estado === 'ausente'    && <span className="badge-ausente    whitespace-nowrap hidden sm:inline-flex">Ausente</span>}
        {estado === 'justificada'&& <span className="badge-justificada whitespace-nowrap hidden sm:inline-flex">Justificada</span>}

        {/* Botones de acción */}
        <div className="flex gap-1 flex-shrink-0">
          {btns.map(b => {
            const active = estado === b.key;
            return (
              <button key={b.key} title={b.title}
                onClick={() => {
                  if (b.key === 'justificada') { setJustMode(m => !m); return; }
                  onMark(alumna.id, b.key);
                }}
                className="w-7 h-7 rounded-lg text-xs font-bold transition-all border"
                style={active
                  ? { color: b.color, background: b.bg, borderColor: b.color }
                  : { color: '#D1D5DB', background: 'transparent', borderColor: '#E5E7EB' }
                }
              >
                {b.icon}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel de justificación */}
      {justMode && (
        <div className="px-4 pb-3 pt-1 flex gap-2 bg-purple-50/50">
          <input
            value={justText}
            onChange={e => setJustText(e.target.value)}
            placeholder="Motivo de justificación…"
            className="flex-1 text-sm border border-purple-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
          />
          <button
            onClick={() => {
              if (justText.trim().length >= 3) {
                onMark(alumna.id, 'justificada', justText.trim());
                setJustMode(false);
              }
            }}
            className="px-3 py-2 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 whitespace-nowrap"
          >
            Guardar
          </button>
          <button onClick={() => setJustMode(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1">✕</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCION CARD — expandible con lista de alumnas y marcado
// ─────────────────────────────────────────────────────────────────────────────

function SeccionCard({ r, fecha }: { r: ResumenSeccion; fecha: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const pct = Number(r.total) > 0
    ? Math.round((Number(r.puntuales) + Number(r.tardanzas) + Number(r.justificadas)) / Number(r.total) * 100)
    : 0;

  const { data: alumnas = [], isLoading } = useQuery({
    queryKey: ['seccion-alumnas', r.seccion_id, fecha],
    queryFn:  () => asistenciasApi.porSeccion(r.seccion_id, fecha),
    enabled:  open,
    refetchInterval: open ? 30_000 : false,
  });

  const { mutate, isPending, variables: mutVars } = useMutation({
    mutationFn: ({ alumna_id, estado, justificacion }: {
      alumna_id: string; estado: string; justificacion?: string;
    }) => asistenciasApi.marcarManual(alumna_id, fecha, estado, justificacion),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['seccion-alumnas', r.seccion_id, fecha] });
      void qc.invalidateQueries({ queryKey: ['resumen'] });
    },
  });

  const barColor = pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-400' : 'bg-red-400';
  const pctColor = pct >= 90 ? 'text-emerald-600' : pct >= 75 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
      >
        {/* Sección badge */}
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-nsr-navy flex items-center justify-center">
          <span className="text-xs font-bold text-white">{r.seccion}</span>
        </div>

        {/* Info central */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-sm font-bold text-gray-800">{r.grado} &quot;{r.seccion}&quot;</span>
            <span className="text-xs text-gray-400">{Number(r.total)} alumnas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`text-xs font-bold ${pctColor} w-9 text-right flex-shrink-0`}>{pct}%</span>
          </div>
        </div>

        {/* Chips de conteo (desktop) */}
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          <Chip value={Number(r.puntuales)}    color="text-emerald-700" bg="bg-emerald-50" icon="✓" />
          <Chip value={Number(r.tardanzas)}    color="text-amber-700"   bg="bg-amber-50"   icon="⏱" />
          {Number(r.justificadas) > 0 && (
            <Chip value={Number(r.justificadas)} color="text-purple-700" bg="bg-purple-50" icon="~" />
          )}
          <Chip value={Number(r.ausentes)}     color="text-red-700"     bg="bg-red-50"     icon="✕" />
        </div>

        {/* Chevron */}
        <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Lista de alumnas */}
      {open && (
        <div className="border-t border-gray-100">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-gray-400">Cargando alumnas…</p>
          ) : (alumnas as AsistenciaAlumna[]).length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Sin registros para esta fecha</p>
          ) : (
            (alumnas as AsistenciaAlumna[]).map(a => (
              <StudentRow
                key={a.id}
                alumna={a}
                fecha={fecha}
                loading={isPending && mutVars?.alumna_id === a.id}
                onMark={(id, estado, just) => mutate({ alumna_id: id, estado, justificacion: just })}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ value, color, bg, icon }: { value: number; color: string; bg: string; icon: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${color} ${bg} rounded-lg px-2 py-1`}>
      {icon} {value}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: REGISTRAR NUEVA ALUMNA
// ─────────────────────────────────────────────────────────────────────────────

function RegistroModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ apellidos: '', nombres: '', dni: '', seccion_id: '', foto_url: '' });
  const [err, setErr] = useState('');

  const { data: secciones = [] } = useQuery({
    queryKey: ['secciones'],
    queryFn: () => alumnasApi.secciones(),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: () => alumnasApi.crear({
      nombres:    form.nombres.trim(),
      apellidos:  form.apellidos.trim(),
      seccion_id: Number(form.seccion_id),
      ...(form.dni.trim()     ? { dni:      form.dni.trim()     } : {}),
      ...(form.foto_url.trim()? { foto_url: form.foto_url.trim()} : {}),
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['resumen'] });
      onClose();
    },
    onError: (e: Error) => setErr(e.message),
  });

  function set(field: keyof typeof form) {
    return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!form.apellidos.trim() || !form.nombres.trim() || !form.seccion_id) {
      setErr('Apellidos, nombres y sección son obligatorios');
      return;
    }
    if (form.dni && form.dni.trim().length !== 8) {
      setErr('El DNI debe tener exactamente 8 dígitos');
      return;
    }
    mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-nsr-navy">Registrar alumna nueva</h2>
            <p className="text-xs text-gray-400 mt-0.5">El código QR se genera automáticamente</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-sm font-bold">✕</button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Apellidos *</label>
              <input value={form.apellidos} onChange={set('apellidos')}
                placeholder="García López" className="input text-sm" required />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Nombres *</label>
              <input value={form.nombres} onChange={set('nombres')}
                placeholder="María Elena" className="input text-sm" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">DNI (opcional)</label>
              <input value={form.dni} onChange={set('dni')}
                placeholder="12345678" maxLength={8} inputMode="numeric" className="input text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Sección *</label>
              <select value={form.seccion_id} onChange={set('seccion_id')} className="input text-sm" required>
                <option value="">Seleccionar…</option>
                {(secciones as Seccion[]).map(s => (
                  <option key={s.id} value={s.id}>{s.grado} &quot;{s.nombre}&quot;</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">URL de foto (opcional)</label>
            <input value={form.foto_url} onChange={set('foto_url')}
              placeholder="https://drive.google.com/…" type="url" className="input text-sm" />
          </div>

          {err && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2">
              <span className="font-bold">!</span> {err}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm py-2.5">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1 text-sm py-2.5">
              {isPending ? 'Guardando…' : 'Registrar alumna'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD PAGE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { usuario } = useAuth();
  const [fecha, setFecha] = useState(TODAY);
  const [showRegistro, setShowRegistro] = useState(false);

  // Resumen por sección (siempre hoy, refetch cada 30s)
  const { data: resumen = [], isLoading } = useQuery({
    queryKey: ['resumen'],
    queryFn:  asistenciasApi.resumen,
    refetchInterval: 30_000,
  });

  // Tendencia últimos 7 días
  const { data: tendencia = [] } = useQuery({
    queryKey: ['tendencia', 7],
    queryFn:  () => asistenciasApi.tendencia(7),
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
  });

  // Totales globales de hoy
  const totales = useMemo(() => resumen.reduce((acc, r) => ({
    total:        acc.total        + Number(r.total),
    puntuales:    acc.puntuales    + Number(r.puntuales),
    tardanzas:    acc.tardanzas    + Number(r.tardanzas),
    justificadas: acc.justificadas + Number(r.justificadas),
    ausentes:     acc.ausentes     + Number(r.ausentes),
  }), { total: 0, puntuales: 0, tardanzas: 0, justificadas: 0, ausentes: 0 }), [resumen]);

  const pctGlobal = totales.total > 0
    ? Math.round((totales.puntuales + totales.tardanzas + totales.justificadas) / totales.total * 100)
    : 0;

  const fechaDisplay = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="space-y-5">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-nsr-navy capitalize leading-tight">{fechaDisplay}</h1>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-emerald-600 font-medium">Actualiza en tiempo real</span>
          </div>
        </div>
        {usuario?.rol === 'admin' && (
          <button
            onClick={() => setShowRegistro(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-nsr-navy text-white text-sm font-semibold rounded-xl hover:bg-nsr-navy/90 transition-colors shadow-sm whitespace-nowrap flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nueva alumna
          </button>
        )}
      </div>

      {/* ── KPI cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Total" value={totales.total} icon="👥"
          colorClass="text-nsr-navy" bgClass="bg-blue-50"
          sub={`${pctGlobal}% asistencia global`}
        />
        <KpiCard
          label="Puntuales" value={totales.puntuales} icon="✅"
          colorClass="text-emerald-600" bgClass="bg-emerald-50"
          sub={totales.total > 0 ? `${Math.round(totales.puntuales / totales.total * 100)}% del total` : '—'}
        />
        <KpiCard
          label="Tardanzas" value={totales.tardanzas} icon="⏱"
          colorClass="text-amber-600" bgClass="bg-amber-50"
          sub={totales.total > 0 ? `${Math.round(totales.tardanzas / totales.total * 100)}% del total` : '—'}
        />
        <KpiCard
          label="Ausentes" value={totales.ausentes} icon="❌"
          colorClass="text-red-600" bgClass="bg-red-50"
          sub={totales.total > 0 ? `${Math.round(totales.ausentes / totales.total * 100)}% del total` : '—'}
        />
      </div>

      {/* ── Gráficos ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Donut: distribución de hoy */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Distribución del día</h2>
          <div className="flex items-center gap-5">
            <DonutChart
              puntuales={totales.puntuales}
              tardanzas={totales.tardanzas}
              ausentes={totales.ausentes}
              justificadas={totales.justificadas}
            />
            <div className="flex flex-col gap-3 flex-1">
              {([
                { label: 'Puntuales',    value: totales.puntuales,    color: '#002147', bg: '#EFF6FF' },
                { label: 'Tardanzas',    value: totales.tardanzas,    color: '#D97706', bg: '#FFFBEB' },
                { label: 'Justificadas', value: totales.justificadas, color: '#7C3AED', bg: '#F5F3FF' },
                { label: 'Ausentes',     value: totales.ausentes,     color: '#EF4444', bg: '#FFF1F2' },
              ] as const).map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-xs text-gray-500 flex-1">{s.label}</span>
                  <span className="text-sm font-bold text-gray-800">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Barras: tendencia 7 días */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Tendencia — últimos 7 días</h2>
            <div className="flex items-center gap-3">
              {[
                { color: '#002147', label: 'Puntual' },
                { color: '#FCD34D', label: 'Tardanza' },
                { color: '#FCA5A5', label: 'Ausente' },
              ].map(l => (
                <span key={l.label} className="flex items-center gap-1 text-[10px] text-gray-400">
                  <span className="w-2 h-2 rounded-sm inline-block" style={{ background: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
          <TrendChart data={tendencia as TendenciaDia[]} />
        </div>
      </div>

      {/* ── Por sección ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Por sección</h2>
            {fecha !== TODAY && (
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                {new Date(fecha + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
          <input
            type="date"
            value={fecha}
            max={TODAY}
            onChange={e => setFecha(e.target.value || TODAY)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nsr-navy bg-white text-gray-600"
          />
        </div>

        {isLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-12 text-center">
            <svg className="w-6 h-6 animate-spin text-nsr-navy mx-auto mb-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-gray-400">Cargando secciones…</p>
          </div>
        ) : resumen.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-16 text-center">
            <p className="text-gray-400 text-sm">Sin datos disponibles para hoy</p>
            <p className="text-gray-300 text-xs mt-1">Los datos aparecerán conforme se registren asistencias</p>
          </div>
        ) : (
          <div className="space-y-2">
            {resumen.map(r => (
              <SeccionCard key={r.seccion_id} r={r} fecha={fecha} />
            ))}
          </div>
        )}
      </div>

      {/* ── Modal: nueva alumna ───────────────────────────────── */}
      {showRegistro && <RegistroModal onClose={() => setShowRegistro(false)} />}
    </div>
  );
}
