import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { asistencias as asistenciasApi } from '../services/api';
import type { ResumenSeccion, AsistenciaAlumna } from '../types';

function EstadoBadge({ estado }: { estado: string | null }) {
  const e = estado ?? 'ausente';
  const map: Record<string, string> = {
    puntual: 'badge-puntual', tardanza: 'badge-tardanza',
    ausente: 'badge-ausente', justificada: 'badge-justificada',
  };
  const label: Record<string, string> = {
    puntual: 'Puntual', tardanza: 'Tardanza',
    ausente: 'Ausente', justificada: 'Justificada',
  };
  return <span className={map[e] ?? 'badge-ausente'}>{label[e] ?? e}</span>;
}

function SeccionRow({ r, onClick }: { r: ResumenSeccion; onClick: () => void }) {
  const pct = Number(r.total) > 0
    ? Math.round((Number(r.puntuales) + Number(r.tardanzas) + Number(r.justificadas)) / Number(r.total) * 100)
    : 0;

  return (
    <tr onClick={onClick} className="transition-colors border-b cursor-pointer border-gray-50 hover:bg-blue-50/50 active:bg-blue-100/50">
      <td className="px-4 py-3 text-sm font-semibold text-nsr-navy">{r.grado} &quot;{r.seccion}&quot;</td>
      <td className="px-4 py-3 text-sm font-medium text-center">{Number(r.total)}</td>
      <td className="px-4 py-3 text-sm font-bold text-center text-emerald-600">{Number(r.puntuales)}</td>
      <td className="px-4 py-3 text-sm font-bold text-center text-amber-600">{Number(r.tardanzas)}</td>
      <td className="px-4 py-3 text-sm font-bold text-center text-red-600">{Number(r.ausentes)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-100 rounded-full">
            <div
              className={`h-2 rounded-full transition-all ${pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="w-8 text-xs font-medium text-right text-gray-500">{pct}%</span>
        </div>
      </td>
    </tr>
  );
}

export default function DashboardPage() {
  const [seccionSel, setSeccionSel] = useState<{ id: number; nombre: string } | null>(null);
  const [gradoFiltro, setGradoFiltro] = useState('');

  const { data: resumen = [], isLoading } = useQuery({
    queryKey: ['resumen'],
    queryFn: asistenciasApi.resumen,
    refetchInterval: 30_000,
  });

  const { data: detalleSeccion } = useQuery({
    queryKey: ['seccion', seccionSel?.id],
    queryFn: () => asistenciasApi.porSeccion(seccionSel!.id),
    enabled: !!seccionSel,
  });

  const grados = [...new Set(resumen.map(r => r.grado))].sort();
  const filtrado = gradoFiltro ? resumen.filter(r => r.grado === gradoFiltro) : resumen;

  const totales = resumen.reduce(
    (acc, r) => ({
      total:     acc.total     + Number(r.total),
      puntuales: acc.puntuales + Number(r.puntuales),
      tardanzas: acc.tardanzas + Number(r.tardanzas),
      ausentes:  acc.ausentes  + Number(r.ausentes),
    }),
    { total: 0, puntuales: 0, tardanzas: 0, ausentes: 0 }
  );

  const pctGlobal = totales.total > 0
    ? Math.round((totales.puntuales + totales.tardanzas) / totales.total * 100)
    : 0;

  return (
    <div className="space-y-5">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold capitalize text-nsr-navy">
            {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Actualiza cada 30 segundos</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-nsr-navy">{pctGlobal}%</p>
          <p className="text-xs text-gray-400">asistencia</p>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total',      value: totales.total,     color: 'text-nsr-navy',    bg: 'bg-blue-50' },
          { label: 'Puntuales',  value: totales.puntuales, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Tardanzas',  value: totales.tardanzas, color: 'text-amber-600',   bg: 'bg-amber-50' },
          { label: 'Ausentes',   value: totales.ausentes,  color: 'text-red-600',     bg: 'bg-red-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`stat-tile ${bg}`}>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            <p className="mt-1 text-xs font-medium text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabla por sección */}
      <div className="p-0 overflow-hidden card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-nsr-navy">Por sección</h2>
          <select
            value={gradoFiltro}
            onChange={e => setGradoFiltro(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-nsr-navy bg-gray-50"
          >
            <option value="">Todos los grados</option>
            {grados.map(g => <option key={g} value={g}>{g} Secundaria</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-gray-400">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Cargando...
          </div>
        ) : filtrado.length === 0 ? (
          <p className="py-10 text-sm text-center text-gray-400">Sin datos aún</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="text-xs font-semibold tracking-wide text-gray-400 uppercase bg-gray-50">
                <tr>
                  <th className="py-2.5 px-4 text-left">Sección</th>
                  <th className="py-2.5 px-4 text-center">Total</th>
                  <th className="py-2.5 px-4 text-center">Punt.</th>
                  <th className="py-2.5 px-4 text-center">Tard.</th>
                  <th className="py-2.5 px-4 text-center">Aus.</th>
                  <th className="py-2.5 px-4 text-center">Asistencia</th>
                </tr>
              </thead>
              <tbody>
                {filtrado.map(r => (
                  <SeccionRow
                    key={r.seccion_id}
                    r={r}
                    onClick={() => setSeccionSel({ id: r.seccion_id, nombre: `${r.grado} "${r.seccion}"` })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal detalle sección */}
      {seccionSel && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 bg-black/60 sm:items-center sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setSeccionSel(null); }}
        >
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
            {/* Handle móvil */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div>
                <p className="font-bold text-nsr-navy">{seccionSel.nombre}</p>
                <p className="text-xs text-gray-400">
                  {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
              <button
                onClick={() => setSeccionSel(null)}
                className="flex items-center justify-center w-8 h-8 text-gray-500 transition-colors bg-gray-100 rounded-full hover:bg-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {!detalleSeccion ? (
                <p className="py-8 text-sm text-center text-gray-400">Cargando...</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {(detalleSeccion as AsistenciaAlumna[]).map((a, i) => (
                    <div key={a.id ?? i} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-full bg-nsr-navy/10">
                          <span className="text-xs font-bold text-nsr-navy">{a.apellidos.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-tight text-gray-900">{a.apellidos}, {a.nombres}</p>
                          {a.hora_escaneo && (
                            <p className="text-xs text-gray-400">
                              {new Date(a.hora_escaneo).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                      <EstadoBadge estado={a.estado} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
