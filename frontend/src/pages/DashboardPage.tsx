import { useState, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { asistencias as asistenciasApi } from '../services/api';
import type { ResumenSeccion, AsistenciaAlumna, TendenciaDia } from '../types';

const TODAY = new Date().toISOString().slice(0, 10);

// ─── Icons ────────────────────────────────────────────────────────────────────

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
  spinner: (
    <svg className="animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  ),
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcPct(r: ResumenSeccion): number {
  const t = Number(r.total);
  if (t === 0) return 0;
  return Math.round((Number(r.puntuales) + Number(r.tardanzas) + Number(r.justificadas)) / t * 100);
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

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

// ─── KPI Card ─────────────────────────────────────────────────────────────────

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

// ─── Donut Chart ──────────────────────────────────────────────────────────────

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

// ─── Weekly Attendance Chart ──────────────────────────────────────────────────

function WeeklyChart({ data }: { data: TendenciaDia[] }) {
  if (!data.length) return null;
  const days = data.slice(-7);
  const BAR_H = 80;

  function pctOf(d: TendenciaDia) {
    return d.total > 0
      ? Math.round((d.puntuales + d.tardanzas + d.justificadas) / d.total * 100)
      : 0;
  }
  function pctColor(p: number) {
    return p >= 90 ? '#059669' : p >= 75 ? '#D97706' : '#EF4444';
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium text-gray-700">Asistencia semanal</p>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-[#059669]"/>≥ 90%</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-amber-400"/>75-89%</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-red-400"/>&lt; 75%</span>
        </div>
      </div>

      {/* Referencia horizontal 90% */}
      <div className="relative mt-5" style={{ paddingBottom: 28 }}>
        {/* Líneas de referencia */}
        {[90, 75].map(ref => (
          <div key={ref} className="absolute w-full flex items-center gap-1 pointer-events-none"
            style={{ bottom: 28 + ref * BAR_H / 100 - 1 }}>
            <div className="flex-1 border-t border-dashed border-gray-200" />
            <span className="text-[9px] text-gray-300 w-6 text-right">{ref}%</span>
          </div>
        ))}

        {/* Barras */}
        <div className="flex items-end gap-2" style={{ height: BAR_H }}>
          {days.map((d, i) => {
            const isToday = i === days.length - 1;
            const pct = pctOf(d);
            const barH = Math.max(Math.round(pct * BAR_H / 100), 2);
            const color = isToday ? '#002147' : pctColor(pct) + '33'; // 33 = ~20% opacity

            return (
              <div key={d.fecha} className="flex-1 flex flex-col items-center gap-0">
                <div className="flex items-end w-full" style={{ height: BAR_H }}>
                  <div className="w-full rounded-t" style={{ height: barH, background: color,
                    ...(isToday ? {} : { background: '#E5E7EB' }) }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Etiquetas eje X */}
        <div className="flex gap-2 mt-2">
          {days.map((d, i) => {
            const isToday = i === days.length - 1;
            const pct = pctOf(d);
            return (
              <div key={d.fecha} className="flex-1 flex flex-col items-center gap-0.5">
                <span className="text-[10px] font-semibold" style={{ color: isToday ? pctColor(pct) : '#D1D5DB' }}>
                  {pct > 0 ? `${pct}%` : '—'}
                </span>
                <span className={`text-[10px] ${isToday ? 'text-gray-600 font-semibold' : 'text-gray-400'}`}>
                  {isToday ? 'Hoy' : d.dia}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Student Row (solo lectura) ───────────────────────────────────────────────

function StudentRow({ alumna }: { alumna: AsistenciaAlumna }) {
  const estado = alumna.estado ?? 'ausente';
  const time = alumna.hora_escaneo
    ? new Date(alumna.hora_escaneo).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '—';
  return (
    <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500 flex-shrink-0 select-none">
          {alumna.apellidos[0]}
        </div>
        <p className="text-sm font-medium text-gray-900 truncate">{alumna.apellidos}, {alumna.nombres}</p>
      </div>
      <div className="w-14 text-right hidden sm:block">
        <span className="text-sm text-gray-400 tabular-nums whitespace-nowrap">{time}</span>
      </div>
      <div className="w-28 flex justify-center">
        <StatusBadge estado={estado} />
      </div>
    </div>
  );
}

// ─── Stat Column (dentro de SeccionCard) ─────────────────────────────────────

function StatCol({ value, label, color = 'text-gray-900' }: { value: number; label: string; color?: string }) {
  return (
    <div className="text-center">
      <p className={`text-sm font-semibold ${color}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

// ─── Seccion Card ─────────────────────────────────────────────────────────────

function SeccionCard({ r, fecha }: { r: ResumenSeccion; fecha: string }) {
  const [open, setOpen] = useState(false);
  const pct = calcPct(r);

  const { data: alumnas = [], isLoading } = useQuery({
    queryKey: ['seccion-alumnas', r.seccion_id, fecha],
    queryFn: () => asistenciasApi.porSeccion(r.seccion_id, fecha),
    enabled: open,
    refetchInterval: open ? 30_000 : false,
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

      {/* Cabecera expandible */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50/80 transition-colors"
      >
        {/* Badge sección */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold flex-shrink-0 transition-colors ${
          open ? 'bg-[#002147] text-white' : 'bg-gray-100 text-gray-600'
        }`}>
          {r.seccion}
        </div>

        {/* Nombre + barra de progreso */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2.5 mb-2">
            <span className="text-sm font-semibold text-gray-900">{r.grado} &quot;{r.seccion}&quot;</span>
            <span className="text-xs text-gray-400">{Number(r.total)} alumnas</span>
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#002147] rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Stats numéricas */}
        <div className="hidden md:flex items-center gap-6 flex-shrink-0">
          <StatCol value={Number(r.puntuales)}    label="Puntual" />
          <StatCol value={Number(r.tardanzas)}    label="Tardanza"  color={Number(r.tardanzas)    > 0 ? 'text-amber-600' : 'text-gray-900'} />
          {Number(r.justificadas) > 0 && <StatCol value={Number(r.justificadas)} label="Justif." color="text-blue-600" />}
          <StatCol value={Number(r.ausentes)}     label="Ausente"   color={Number(r.ausentes)     > 0 ? 'text-red-500'   : 'text-gray-900'} />
        </div>

        {/* Porcentaje + chevron */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <span className="text-sm font-semibold text-gray-700 w-10 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
          <ChevronIcon open={open} />
        </div>
      </button>

      {/* Lista expandida */}
      {open && (
        <div className="border-t border-gray-100">
          <div className="flex items-center gap-4 px-5 py-2.5 bg-gray-50 border-b border-gray-100">
            <div className="flex-1">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Alumna</span>
            </div>
            <div className="w-14 text-right hidden sm:block">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Hora</span>
            </div>
            <div className="w-28 text-center">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Estado</span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
              <span className="w-4 h-4">{Icon.spinner}</span> Cargando…
            </div>
          ) : (alumnas as AsistenciaAlumna[]).length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Sin registros para esta fecha</p>
          ) : (
            (alumnas as AsistenciaAlumna[]).map(a => <StudentRow key={a.id} alumna={a} />)
          )}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [fecha, setFecha] = useState(TODAY);

  const { data: resumen = [], isLoading } = useQuery({
    queryKey: ['resumen'],
    queryFn: asistenciasApi.resumen,
    refetchInterval: 30_000,
  });

  const { data: tendencia = [] } = useQuery({
    queryKey: ['tendencia', 7],
    queryFn: () => asistenciasApi.tendencia(7),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
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

      {/* Encabezado + filtro de fecha */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-gray-900 capitalize">{fechaDisplay}</h1>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-gray-400">Actualiza cada 30 segundos</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {fecha !== TODAY && (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md whitespace-nowrap">
              {new Date(fecha + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}
            </span>
          )}
          <input type="date" value={fecha} max={TODAY}
            onChange={e => setFecha(e.target.value || TODAY)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Total alumnas" value={totales.total}
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

      {/* Donut + Weekly chart */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Donut */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-700 mb-5">Distribución del día</p>
          <div className="flex items-center gap-6">
            <DonutChart
              puntuales={totales.puntuales} tardanzas={totales.tardanzas}
              ausentes={totales.ausentes} justificadas={totales.justificadas}
            />
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

        {/* Weekly chart */}
        <div className="lg:col-span-3">
          <WeeklyChart data={tendencia as TendenciaDia[]} />
        </div>

      </div>

      {/* Secciones — cards expandibles */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">Por sección</p>

        {isLoading ? (
          <div className="bg-white border border-gray-200 rounded-xl py-12 flex items-center justify-center gap-2 text-sm text-gray-400">
            <span className="w-4 h-4">{Icon.spinner}</span> Cargando…
          </div>
        ) : resumen.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl py-14 text-center">
            <p className="text-sm text-gray-400">Sin datos para hoy</p>
            <p className="text-xs text-gray-300 mt-1">Los registros aparecerán conforme se escaneen los QR</p>
          </div>
        ) : (
          <div className="space-y-2">
            {resumen.map(r => <SeccionCard key={r.seccion_id} r={r} fecha={fecha} />)}
          </div>
        )}
      </div>

    </div>
  );
}
