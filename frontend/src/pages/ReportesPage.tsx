import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportes } from '../services/api';
import ExcelJS from 'exceljs';

type Fila = {
  apellidos: string;
  nombres: string;
  dni?: string;
  grado: string;
  seccion: string;
  fecha: string;
  estado: string | null;
  hora?: string;
};

type RankingFila = {
  apellidos: string;
  nombres: string;
  grado: string;
  seccion: string;
  tardanzas: number;
  ausencias: number;
};

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

const ESTADO_COLORS: Record<string, string> = {
  puntual:     'FFD1FAE5',
  tardanza:    'FFFEF3C7',
  ausente:     'FFFEE2E2',
  justificada: 'FFDBEAFE',
};

export default function ReportesPage() {
  const hoy = new Date().toISOString().slice(0, 10);
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [buscar, setBuscar] = useState(false);
  const [exportando, setExportando] = useState(false);

  const { data: filas = [], isLoading } = useQuery({
    queryKey: ['reporte', desde, hasta],
    queryFn: () => reportes.rango(desde, hasta),
    enabled: buscar,
  });

  const { data: ranking = [] } = useQuery({
    queryKey: ['ranking', desde, hasta],
    queryFn: () => reportes.ranking(desde, hasta),
    enabled: buscar,
  });

  async function exportarExcel() {
    if (!(filas as Fila[]).length) return;
    setExportando(true);
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Sistema NSR';

      const ws = wb.addWorksheet('Asistencias', {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
      });

      // Título del reporte
      ws.mergeCells('A1:H1');
      const titleCell = ws.getCell('A1');
      titleCell.value = `I.E. Nuestra Señora del Rosario — Reporte de Asistencias  |  ${desde} al ${hasta}`;
      titleCell.font  = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002147' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(1).height = 24;

      // Columnas
      ws.columns = [
        { key: 'apellidos', width: 22 },
        { key: 'nombres',   width: 22 },
        { key: 'dni',       width: 11 },
        { key: 'grado',     width: 7  },
        { key: 'seccion',   width: 7  },
        { key: 'fecha',     width: 12 },
        { key: 'estado',    width: 13 },
        { key: 'hora',      width: 7  },
      ];

      // Encabezados
      const headers = ['Apellidos', 'Nombres', 'DNI', 'Grado', 'Sección', 'Fecha', 'Estado', 'Hora'];
      const headerRow = ws.addRow(headers);
      headerRow.height = 18;
      headerRow.eachCell(cell => {
        cell.font  = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF660000' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FF4d0000' } } };
      });

      // Datos
      (filas as Fila[]).forEach((f, idx) => {
        const estado = (f.estado ?? 'ausente').toLowerCase();
        const row = ws.addRow([
          f.apellidos,
          f.nombres,
          f.dni ?? '',
          f.grado,
          f.seccion,
          f.fecha ?? '',
          estado.charAt(0).toUpperCase() + estado.slice(1),
          f.hora ?? '',
        ]);
        row.height = 16;

        const bgColor = ESTADO_COLORS[estado] ?? 'FFFFFFFF';
        const isOdd = idx % 2 === 0;
        row.eachCell((cell, colNum) => {
          cell.fill = {
            type: 'pattern', pattern: 'solid',
            fgColor: { argb: estado !== 'puntual' && estado !== 'ausente' && estado !== 'tardanza' && estado !== 'justificada'
              ? (isOdd ? 'FFF9FAFB' : 'FFFFFFFF')
              : bgColor },
          };
          cell.alignment = { vertical: 'middle', horizontal: colNum <= 2 ? 'left' : 'center' };
          cell.border = {
            bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          };
          cell.font = { size: 9.5 };
        });
      });

      // Freeze panes
      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }];

      // Descargar
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Asistencias_NSR_${desde}_${hasta}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-5">

      <h1 className="text-lg font-bold text-nsr-navy">Reportes de asistencia</h1>

      {/* Filtros */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3 flex-1">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Desde</label>
              <input
                type="date"
                value={desde}
                max={hoy}
                onChange={e => { setDesde(e.target.value); setBuscar(false); }}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Hasta</label>
              <input
                type="date"
                value={hasta}
                min={desde}
                max={hoy}
                onChange={e => { setHasta(e.target.value); setBuscar(false); }}
                className="input"
              />
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-2 sm:flex-shrink-0">
            <button
              onClick={() => setBuscar(true)}
              className="btn-primary whitespace-nowrap flex-1 sm:flex-none"
            >
              Generar reporte
            </button>
            {(filas as Fila[]).length > 0 && (
              <button
                onClick={exportarExcel}
                disabled={exportando}
                className="btn-secondary flex items-center gap-1.5 whitespace-nowrap"
                title="Exportar a Excel"
              >
                {exportando ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                Excel
              </button>
            )}
          </div>
        </div>
      </div>

      {buscar && (
        <>
          {/* Ranking tardanzas */}
          {(ranking as RankingFila[]).length > 0 && (
            <div className="card">
              <h2 className="font-bold text-nsr-navy mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-nsr-wine rounded-full inline-block" />
                Top tardanzas / ausencias
              </h2>
              <div className="space-y-1">
                {(ranking as RankingFila[]).slice(0, 10).map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-300 w-5">{i + 1}</span>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm leading-tight">
                          {r.apellidos}, {r.nombres}
                        </p>
                        <p className="text-xs text-gray-400">{r.grado} &quot;{r.seccion}&quot;</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      {Number(r.tardanzas) > 0 && <span className="badge-tardanza">{Number(r.tardanzas)} tard.</span>}
                      {Number(r.ausencias) > 0 && <span className="badge-ausente">{Number(r.ausencias)} aus.</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabla detallada */}
          <div className="card overflow-hidden p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="font-bold text-nsr-navy text-sm flex items-center gap-2">
                <span className="w-1 h-4 bg-nsr-wine rounded-full inline-block" />
                Detalle del período
              </h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
                {(filas as Fila[]).length} registros
              </span>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-gray-400 text-sm">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Cargando...
              </div>
            ) : (filas as Fila[]).length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-400 text-sm">Sin datos para este período</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-400 text-xs font-semibold uppercase tracking-wide">
                    <tr>
                      <th className="py-2.5 px-4 text-left">Alumna</th>
                      <th className="py-2.5 px-4 text-left hidden sm:table-cell">Sección</th>
                      <th className="py-2.5 px-4 text-left">Fecha</th>
                      <th className="py-2.5 px-4 text-center">Estado</th>
                      <th className="py-2.5 px-4 text-center hidden sm:table-cell">Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(filas as Fila[]).map((f, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-900 leading-tight">{f.apellidos},</p>
                          <p className="font-medium text-gray-900 leading-tight">{f.nombres}</p>
                        </td>
                        <td className="py-3 px-4 text-gray-500 hidden sm:table-cell">
                          {f.grado} &quot;{f.seccion}&quot;
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-xs font-medium">
                          {f.fecha ?? '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <EstadoBadge estado={f.estado} />
                        </td>
                        <td className="py-3 px-4 text-center text-gray-400 text-xs hidden sm:table-cell">
                          {f.hora ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
