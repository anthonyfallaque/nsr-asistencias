import { useState, useMemo, useEffect, type ReactNode } from 'react';
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
  panel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  ),
  spinner: (
    <svg className="animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  ),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcPct(r: ResumenSeccion): number {
  const t = Number(r.total);
  if (t === 0) return 0;
  return Math.round((Number(r.puntuales) + Number(r.tardanzas) + Number(r.justificadas)) / t * 100);
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<string, { dot: string; cls: string; label: string }> = {
  puntual:    { dot: 'bg-emerald-500', cls: 'badge-puntual',    label: 'Puntual'      },
  tardanza:   { dot: 'bg-amber-500',   cls: 'badge-tardanza',   label: 'Tardanza'     },
  ausente:    { dot: 'bg-red-500',     cls: 'badge-ausente',    label: 'Ausente'      },
  justificada:{ dot: 'bg-blue-500',    cls: 'badge-justificada',label: 'Justificada'  },
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

// ─── Trend Chart ──────────────────────────────────────────────────────────────

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
        const hP = d.puntuales > 0 ? Math.max(d.puntuales * sc, 2) : 0;
        const hT = d.tardanzas > 0 ? Math.max(d.tardanzas * sc, 2) : 0;
        const hA = d.ausentes  > 0 ? Math.max(d.ausentes  * sc, 2) : 0;
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
      <div className="w-16 text-right hidden sm:block">
        <span className="text-sm text-gray-400" style={{ fontVariantNumeric: 'tabular-nums' }}>{time}</span>
      </div>
      <div className="w-28 flex justify-center">
        <StatusBadge estado={estado} />
      </div>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [fecha, setFecha] = useState(TODAY);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedSeccionId, setSelectedSeccionId] = useState<number | null>(null);

  const { data: resumen = [], isLoading: resumenLoading } = useQuery({
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

  useEffect(() => {
    if (resumen.length > 0 && selectedSeccionId === null) {
      setSelectedSeccionId(resumen[0].seccion_id);
    }
  }, [resumen, selectedSeccionId]);

  const { data: alumnas = [], isLoading: alumnosLoading } = useQuery({
    queryKey: ['seccion-alumnas', selectedSeccionId, fecha],
    queryFn: () => asistenciasApi.porSeccion(selectedSeccionId!, fecha),
    enabled: selectedSeccionId !== null,
    refetchInterval: 30_000,
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

  const selectedSection = resumen.find(r => r.seccion_id === selectedSeccionId) ?? null;
  const selectedPct = selectedSection ? calcPct(selectedSection) : 0;

  const fechaDisplay = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="space-y-5">

      {/* Encabezado */}
      <div>
        <h1 className="text-base font-semibold text-gray-900 capitalize">{fechaDisplay}</h1>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-gray-400">Actualiza cada 30 segundos</span>
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

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
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

      {/* Secciones — sidebar plegable + detalle */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex" style={{ minHeight: 420 }}>

        {/* ── Sidebar secciones ── */}
        <div className={`flex-shrink-0 border-r border-gray-200 flex flex-col transition-all duration-200 ${sidebarOpen ? 'w-52' : 'w-14'}`}>

          <div className={`flex items-center border-b border-gray-100 h-11 px-3 gap-2 flex-shrink-0 ${sidebarOpen ? 'justify-between' : 'justify-center'}`}>
            {sidebarOpen && (
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Secciones</span>
            )}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              title={sidebarOpen ? 'Colapsar' : 'Expandir'}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0"
            >
              <span className="w-4 h-4">{Icon.panel}</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {resumenLoading ? (
              <div className="flex items-center justify-center py-10">
                <span className="w-5 h-5 text-gray-300">{Icon.spinner}</span>
              </div>
            ) : resumen.map(r => {
              const pct = calcPct(r);
              const active = r.seccion_id === selectedSeccionId;
              return (
                <button
                  key={r.seccion_id}
                  onClick={() => setSelectedSeccionId(r.seccion_id)}
                  title={!sidebarOpen ? `${r.grado} "${r.seccion}" · ${pct}%` : undefined}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 text-left transition-colors border-r-2 ${
                    active
                      ? 'bg-[#002147]/5 border-[#002147]'
                      : 'hover:bg-gray-50 border-transparent'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold flex-shrink-0 transition-colors ${
                    active ? 'bg-[#002147] text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {r.seccion}
                  </div>
                  {sidebarOpen && (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.grado} &quot;{r.seccion}&quot;</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="flex-1 h-0.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#002147] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Panel detalle ── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {!selectedSection ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              Selecciona una sección
            </div>
          ) : (
            <>
              {/* Cabecera del panel */}
              <div className="flex items-center justify-between gap-4 px-5 h-11 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-baseline gap-2 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {selectedSection.grado} &quot;{selectedSection.seccion}&quot;
                  </p>
                  <p className="text-xs text-gray-400 flex-shrink-0">{Number(selectedSection.total)} alumnas</p>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="hidden sm:flex items-center gap-5">
                    {[
                      { v: Number(selectedSection.puntuales),    l: 'Puntual',  c: 'text-gray-900' },
                      { v: Number(selectedSection.tardanzas),    l: 'Tardanza', c: Number(selectedSection.tardanzas)    > 0 ? 'text-amber-600' : 'text-gray-900' },
                      { v: Number(selectedSection.justificadas), l: 'Justif.',  c: Number(selectedSection.justificadas) > 0 ? 'text-blue-600'  : 'text-gray-900' },
                      { v: Number(selectedSection.ausentes),     l: 'Ausente',  c: Number(selectedSection.ausentes)     > 0 ? 'text-red-500'   : 'text-gray-900' },
                    ].map(s => (
                      <div key={s.l} className="text-center">
                        <p className={`text-sm font-semibold ${s.c}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{s.v}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{s.l}</p>
                      </div>
                    ))}
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{selectedPct}%</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Asistencia</p>
                    </div>
                  </div>

                  <input type="date" value={fecha} max={TODAY}
                    onChange={e => setFecha(e.target.value || TODAY)}
                    className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
                  />
                </div>
              </div>

              {/* Cabecera de columnas */}
              <div className="flex items-center gap-4 px-5 py-2.5 bg-gray-50 border-b border-gray-100 flex-shrink-0">
                <div className="flex-1">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Alumna</span>
                </div>
                <div className="w-16 text-right hidden sm:block">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Hora</span>
                </div>
                <div className="w-28 text-center">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Estado</span>
                </div>
              </div>

              {/* Filas */}
              <div className="flex-1 overflow-y-auto">
                {alumnosLoading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
                    <span className="w-4 h-4">{Icon.spinner}</span> Cargando…
                  </div>
                ) : (alumnas as AsistenciaAlumna[]).length === 0 ? (
                  <p className="py-10 text-center text-sm text-gray-400">Sin registros para esta fecha</p>
                ) : (
                  (alumnas as AsistenciaAlumna[]).map(a => (
                    <StudentRow key={a.id} alumna={a} />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
}
