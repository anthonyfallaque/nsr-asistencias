import { useState, useMemo, type FormEvent, type ChangeEvent, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { asistencias as asistenciasApi, alumnas as alumnasApi } from '../services/api';
import type { ResumenSeccion, AsistenciaAlumna, TendenciaDia, Seccion } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// ICONS (SVG inline, sin emojis)
// ─────────────────────────────────────────────────────────────────────────────

const Icon = {
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  xCircle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  chevron: (open: boolean) => (
    <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  spinner: (
    <svg className="w-5 h-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE — pequeño, semántico, sin emojis
// ─────────────────────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<string, { dot: string; cls: string; label: string }> = {
  puntual:    { dot: 'bg-emerald-500', cls: 'badge-puntual',    label: 'Puntual'     },
  tardanza:   { dot: 'bg-amber-500',   cls: 'badge-tardanza',   label: 'Tardanza'    },
  ausente:    { dot: 'bg-red-500',     cls: 'badge-ausente',    label: 'Ausente'     },
  justificada:{ dot: 'bg-blue-500',    cls: 'badge-justificada',label: 'Justificada' },
};

function StatusBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CFG[estado] ?? ESTADO_CFG.ausente;
  return (
    <span className={`${cfg.cls} inline-flex items-center gap-1.5`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI CARD — blanca, limpia, icon en gris claro
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon }: {
  label: string; value: number; sub?: string; icon: ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <span className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5">{icon}</span>
      </div>
      <p className="mt-3 text-[28px] font-semibold text-gray-900 leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value.toLocaleString('es-PE')}
      </p>
      {sub && <p className="mt-2 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DONUT CHART — SVG puro
// ─────────────────────────────────────────────────────────────────────────────

function DonutChart({ puntuales, tardanzas, ausentes, justificadas }: {
  puntuales: number; tardanzas: number; ausentes: number; justificadas: number;
}) {
  const r = 52, cx = 68, cy = 68;
  const circ = 2 * Math.PI * r;
  const total = puntuales + tardanzas + ausentes + justificadas;
  const pct = total > 0 ? Math.round((puntuales + tardanzas + justificadas) / total * 100) : 0;

  const segs = [
    { value: puntuales,    color: '#002147' },
    { value: tardanzas,    color: '#D97706' },
    { value: justificadas, color: '#2563EB' },
    { value: ausentes,     color: '#EF4444' },
  ];
  let cumulative = 0;

  return (
    <svg viewBox="0 0 136 136" width="136" height="136" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={14} />
      {total > 0 && segs.map((seg, i) => {
        if (!seg.value) return null;
        const len = (seg.value / total) * circ;
        const off = circ - cumulative;
        cumulative += len;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth={14}
            strokeDasharray={`${len} ${circ}`} strokeDashoffset={off}
            transform={`rotate(-90 ${cx} ${cy})`} />
        );
      })}
      <text x={cx} y={60} textAnchor="middle" fontSize="24" fontWeight="600" fill="#111827">{pct}%</text>
      <text x={cx} y={78} textAnchor="middle" fontSize="10" fill="#9CA3AF">asistencia hoy</text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TREND CHART — barras apiladas
// ─────────────────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);

function TrendChart({ data }: { data: TendenciaDia[] }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-28 text-sm text-gray-300">Sin datos</div>
  );
  const max = Math.max(...data.map(d => d.total), 1);
  const W = 380, H = 124, PB = 22, PT = 6, CH = H - PB - PT;
  const BW = 30, n = data.length, step = n > 1 ? (W - BW) / (n - 1) : W / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ overflow: 'visible', display: 'block' }}>
      {[0, 0.5, 1].map(f => (
        <line key={f} x1={0} y1={PT + CH * (1 - f)} x2={W} y2={PT + CH * (1 - f)}
          stroke="#F3F4F6" strokeWidth={f === 0 ? 1.5 : 1} strokeDasharray={f < 1 ? '3 3' : ''} />
      ))}
      {data.map((d, i) => {
        const x = i * step, isToday = i === n - 1;
        const sc = CH / max;
        const hP = d.puntuales    > 0 ? Math.max(d.puntuales    * sc, 2) : 0;
        const hT = d.tardanzas    > 0 ? Math.max(d.tardanzas    * sc, 2) : 0;
        const hA = d.ausentes     > 0 ? Math.max(d.ausentes     * sc, 2) : 0;
        const yB = PT + CH;
        return (
          <g key={i}>
            {hA > 0 && <rect x={x} y={yB - hP - hT - hA} width={BW} height={hA} fill={isToday ? '#FCA5A5' : '#FECACA'} rx="2" />}
            {hT > 0 && <rect x={x} y={yB - hP - hT}      width={BW} height={hT} fill={isToday ? '#FCD34D' : '#FEF3C7'} rx="2" />}
            {hP > 0 && <rect x={x} y={yB - hP}           width={BW} height={hP} fill={isToday ? '#002147' : '#BFDBFE'} rx="2" />}
            <text x={x + BW / 2} y={H - 5} textAnchor="middle" fontSize="9"
              fill={isToday ? '#374151' : '#9CA3AF'} fontWeight={isToday ? '600' : '400'}>
              {isToday ? 'Hoy' : d.dia}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT ROW — estilo tabla, acciones de texto
// ─────────────────────────────────────────────────────────────────────────────

function StudentRow({ alumna, fecha, onMark, loading }: {
  alumna: AsistenciaAlumna;
  fecha: string;
  onMark: (id: string, estado: string, just?: string) => void;
  loading: boolean;
}) {
  const [justMode, setJustMode] = useState(false);
  const [justText, setJustText] = useState(alumna.justificacion ?? '');
  const estado = alumna.estado ?? 'ausente';

  const ACTIONS = [
    { key: 'puntual',    label: 'Puntual'  },
    { key: 'tardanza',   label: 'Tardanza' },
    { key: 'ausente',    label: 'Ausente'  },
    { key: 'justificada',label: 'Justif.'  },
  ];

  function btnClass(key: string) {
    if (estado !== key) {
      return 'border border-gray-200 text-gray-400 bg-white hover:border-gray-300 hover:text-gray-600';
    }
    const map: Record<string, string> = {
      puntual:    'border border-emerald-200 bg-emerald-50 text-emerald-700',
      tardanza:   'border border-amber-200   bg-amber-50   text-amber-700',
      ausente:    'border border-red-200     bg-red-50     text-red-700',
      justificada:'border border-blue-200    bg-blue-50    text-blue-700',
    };
    return map[key] ?? '';
  }

  return (
    <div className={`border-b border-gray-50 last:border-0 ${loading ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/50 transition-colors">
        {/* Avatar + nombre */}
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500 flex-shrink-0 select-none">
            {alumna.apellidos[0]}
          </div>
          <p className="text-sm font-medium text-gray-900 truncate">{alumna.apellidos}, {alumna.nombres}</p>
        </div>

        {/* Hora */}
        <div className="w-16 text-right hidden sm:block">
          <span className="text-sm text-gray-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {alumna.hora_escaneo
              ? new Date(alumna.hora_escaneo).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
              : '—'}
          </span>
        </div>

        {/* Estado */}
        <div className="w-28 flex justify-center">
          <StatusBadge estado={estado} />
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {ACTIONS.map(a => (
            <button key={a.key}
              onClick={() => a.key === 'justificada' ? setJustMode(m => !m) : onMark(alumna.id, a.key)}
              className={`text-xs font-medium px-2 py-1 rounded-md transition-all ${btnClass(a.key)}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {justMode && (
        <div className="flex gap-2 px-5 pb-3 pt-1 bg-gray-50/80">
          <input value={justText} onChange={e => setJustText(e.target.value)}
            placeholder="Motivo de la justificación…"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
          />
          <button
            onClick={() => { if (justText.trim().length >= 3) { onMark(alumna.id, 'justificada', justText.trim()); setJustMode(false); } }}
            className="px-3 py-2 bg-[#002147] text-white text-sm font-medium rounded-lg hover:bg-[#003070] transition-colors"
          >
            Guardar
          </button>
          <button onClick={() => setJustMode(false)} className="text-gray-400 hover:text-gray-600 px-1 text-lg leading-none">×</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCION CARD — expandible, stats como columnas numéricas
// ─────────────────────────────────────────────────────────────────────────────

function Stat({ value, label, color = 'text-gray-900' }: { value: number; label: string; color?: string }) {
  return (
    <div className="text-center">
      <p className={`text-sm font-semibold ${color}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function SeccionCard({ r, fecha }: { r: ResumenSeccion; fecha: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const pct = Number(r.total) > 0
    ? Math.round((Number(r.puntuales) + Number(r.tardanzas) + Number(r.justificadas)) / Number(r.total) * 100)
    : 0;

  const { data: alumnas = [], isLoading } = useQuery({
    queryKey: ['seccion-alumnas', r.seccion_id, fecha],
    queryFn: () => asistenciasApi.porSeccion(r.seccion_id, fecha),
    enabled: open,
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

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50/80 transition-colors">
        {/* Badge sección */}
        <div className="w-9 h-9 rounded-lg bg-[#002147] text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
          {r.seccion}
        </div>

        {/* Nombre + barra */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2.5 mb-2">
            <span className="text-sm font-semibold text-gray-900">{r.grado} &quot;{r.seccion}&quot;</span>
            <span className="text-xs text-gray-400">{Number(r.total)} alumnas</span>
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#002147] rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Stats numéricos (desktop) */}
        <div className="hidden md:flex items-center gap-6 flex-shrink-0">
          <Stat value={Number(r.puntuales)}  label="Puntual" />
          <Stat value={Number(r.tardanzas)}  label="Tardanza" color={Number(r.tardanzas) > 0 ? 'text-amber-600' : 'text-gray-900'} />
          {Number(r.justificadas) > 0 && <Stat value={Number(r.justificadas)} label="Justif." color="text-blue-600" />}
          <Stat value={Number(r.ausentes)}   label="Ausente"  color={Number(r.ausentes) > 0 ? 'text-red-500' : 'text-gray-900'} />
        </div>

        {/* Porcentaje + chevron */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <span className="text-sm font-semibold text-gray-700 w-10 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
          {Icon.chevron(open)}
        </div>
      </button>

      {/* Lista de alumnas */}
      {open && (
        <div className="border-t border-gray-100">
          {/* Cabecera de columnas */}
          <div className="flex items-center gap-4 px-5 py-2.5 bg-gray-50 border-b border-gray-100">
            <div className="flex-1">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Alumna</span>
            </div>
            <div className="w-16 text-right hidden sm:block">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Hora</span>
            </div>
            <div className="w-28 text-center">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Estado</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Cambiar</span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-gray-400 text-sm">
              {Icon.spinner} Cargando…
            </div>
          ) : (alumnas as AsistenciaAlumna[]).length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Sin registros para esta fecha</p>
          ) : (
            (alumnas as AsistenciaAlumna[]).map(a => (
              <StudentRow key={a.id} alumna={a} fecha={fecha}
                loading={isPending && mutVars?.alumna_id === a.id}
                onMark={(id, est, just) => mutate({ alumna_id: id, estado: est, justificacion: just })}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: NUEVA ALUMNA
// ─────────────────────────────────────────────────────────────────────────────

function NuevaAlumnaModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ apellidos: '', nombres: '', dni: '', seccion_id: '', foto_url: '' });
  const [err, setErr] = useState('');

  const { data: secciones = [] } = useQuery({
    queryKey: ['secciones'],
    queryFn: () => alumnasApi.secciones(),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: () => alumnasApi.crear({
      nombres: form.nombres.trim(),
      apellidos: form.apellidos.trim(),
      seccion_id: Number(form.seccion_id),
      ...(form.dni.trim()      ? { dni:      form.dni.trim()      } : {}),
      ...(form.foto_url.trim() ? { foto_url: form.foto_url.trim() } : {}),
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['resumen'] }); onClose(); },
    onError: (e: Error) => setErr(e.message),
  });

  function set(f: keyof typeof form) {
    return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [f]: e.target.value }));
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-xl border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Nueva alumna</h2>
            <p className="text-xs text-gray-400 mt-0.5">El código QR se genera automáticamente</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 text-lg leading-none transition-colors">×</button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Apellidos *</label>
              <input value={form.apellidos} onChange={set('apellidos')} placeholder="García López" className="input text-sm" required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Nombres *</label>
              <input value={form.nombres} onChange={set('nombres')} placeholder="María Elena" className="input text-sm" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">DNI (opcional)</label>
              <input value={form.dni} onChange={set('dni')} placeholder="12345678"
                maxLength={8} inputMode="numeric" className="input text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Sección *</label>
              <select value={form.seccion_id} onChange={set('seccion_id')} className="input text-sm" required>
                <option value="">Seleccionar…</option>
                {(secciones as Seccion[]).map(s => (
                  <option key={s.id} value={s.id}>{s.grado} &quot;{s.nombre}&quot;</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">URL de foto (opcional)</label>
            <input value={form.foto_url} onChange={set('foto_url')} placeholder="https://…" type="url" className="input text-sm" />
          </div>

          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm py-2.5">Cancelar</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1 text-sm py-2.5">
              {isPending ? 'Guardando…' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { usuario } = useAuth();
  const [fecha, setFecha] = useState(TODAY);
  const [showModal, setShowModal] = useState(false);

  const { data: resumen = [], isLoading } = useQuery({
    queryKey: ['resumen'],
    queryFn: asistenciasApi.resumen,
    refetchInterval: 30_000,
  });

  const { data: tendencia = [] } = useQuery({
    queryKey: ['tendencia', 7],
    queryFn: () => asistenciasApi.tendencia(7),
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
  });

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

      {/* ── Encabezado ────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900 capitalize">{fechaDisplay}</h1>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-gray-400">Actualiza cada 30 segundos</span>
          </div>
        </div>
        {usuario?.rol === 'admin' && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#002147] text-white text-sm font-medium rounded-lg hover:bg-[#003070] transition-colors shadow-sm flex-shrink-0">
            <span className="w-4 h-4">{Icon.plus}</span>
            Nueva alumna
          </button>
        )}
      </div>

      {/* ── KPI cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Total alumnas"  value={totales.total}
          sub={`${pctGlobal}% asistencia hoy`} icon={Icon.users} />
        <KpiCard label="Puntuales" value={totales.puntuales}
          sub={totales.total > 0 ? `${Math.round(totales.puntuales / totales.total * 100)}% del total` : undefined}
          icon={Icon.check} />
        <KpiCard label="Tardanzas" value={totales.tardanzas}
          sub={totales.total > 0 ? `${Math.round(totales.tardanzas / totales.total * 100)}% del total` : undefined}
          icon={Icon.clock} />
        <KpiCard label="Ausentes" value={totales.ausentes}
          sub={totales.total > 0 ? `${Math.round(totales.ausentes / totales.total * 100)}% del total` : undefined}
          icon={Icon.xCircle} />
      </div>

      {/* ── Gráficos ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Donut */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-700 mb-5">Distribución del día</p>
          <div className="flex items-center gap-6">
            <DonutChart puntuales={totales.puntuales} tardanzas={totales.tardanzas}
              ausentes={totales.ausentes} justificadas={totales.justificadas} />
            <div className="flex flex-col gap-3 flex-1">
              {[
                { label: 'Puntuales',    value: totales.puntuales,    dot: 'bg-[#002147]' },
                { label: 'Tardanzas',    value: totales.tardanzas,    dot: 'bg-amber-500'  },
                { label: 'Justificadas', value: totales.justificadas, dot: 'bg-blue-500'   },
                { label: 'Ausentes',     value: totales.ausentes,     dot: 'bg-red-500'    },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                  <span className="text-sm text-gray-500 flex-1">{s.label}</span>
                  <span className="text-sm font-semibold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Barras tendencia */}
        <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm font-medium text-gray-700">Tendencia — últimos 7 días</p>
            <div className="flex items-center gap-4">
              {[
                { color: 'bg-[#002147]', label: 'Puntual'  },
                { color: 'bg-amber-300', label: 'Tardanza' },
                { color: 'bg-red-300',   label: 'Ausente'  },
              ].map(l => (
                <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-gray-400">
                  <span className={`w-2 h-2 rounded-sm inline-block ${l.color}`} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
          <TrendChart data={tendencia as TendenciaDia[]} />
        </div>
      </div>

      {/* ── Por sección ───────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-3">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-gray-700">Por sección</p>
            {fecha !== TODAY && (
              <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                {new Date(fecha + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
          <input type="date" value={fecha} max={TODAY}
            onChange={e => setFecha(e.target.value || TODAY)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
          />
        </div>

        {isLoading ? (
          <div className="bg-white border border-gray-200 rounded-xl py-12 flex items-center justify-center gap-2 text-gray-400 text-sm">
            {Icon.spinner} Cargando secciones…
          </div>
        ) : resumen.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl py-16 text-center">
            <p className="text-sm text-gray-400">Sin datos disponibles para hoy</p>
            <p className="text-xs text-gray-300 mt-1">Los registros aparecerán conforme se escaneen QR</p>
          </div>
        ) : (
          <div className="space-y-2">
            {resumen.map(r => (
              <SeccionCard key={r.seccion_id} r={r} fecha={fecha} />
            ))}
          </div>
        )}
      </div>

      {showModal && <NuevaAlumnaModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
