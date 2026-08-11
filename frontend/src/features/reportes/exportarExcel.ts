import { ESTADOS, normalizarEstado } from '@/shared/domain/asistencia';
import type { FilaReporte } from './api';

/** Relleno por estado, en ARGB. Deriva de la misma paleta que la interfaz. */
const RELLENO: Record<string, string> = {
  puntual: 'FFECFDF3',
  tardanza: 'FFFFFAEB',
  justificada: 'FFEFF8FF',
  ausente: 'FFFEF3F2',
};

/**
 * Exporta el reporte a un archivo .xlsx.
 *
 * `exceljs` se importa dinámicamente dentro de la función, no en la cabecera
 * del módulo. Son cerca de 900 KB: importado de forma estática entraba en el
 * paquete principal y lo descargaba todo el mundo, incluido el portero que
 * solo abre el escáner desde el móvil en la puerta. Así el coste lo paga
 * únicamente quien pulsa "Exportar".
 */
export async function exportarExcel(
  filas: FilaReporte[],
  desde: string,
  hasta: string
): Promise<void> {
  const ExcelJS = await import('exceljs');

  const libro = new ExcelJS.Workbook();
  libro.creator = 'Sistema de Asistencias NSR';
  libro.created = new Date();

  const hoja = libro.addWorksheet('Asistencias', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  hoja.columns = [
    { key: 'apellidos', width: 24 },
    { key: 'nombres', width: 22 },
    { key: 'dni', width: 11 },
    { key: 'grado', width: 9 },
    { key: 'seccion', width: 9 },
    { key: 'fecha', width: 12 },
    { key: 'estado', width: 14 },
    { key: 'hora', width: 9 },
  ];

  hoja.mergeCells('A1:H1');
  const titulo = hoja.getCell('A1');
  titulo.value = `I. E. Nuestra Señora del Rosario · Reporte de asistencias · ${desde} al ${hasta}`;
  titulo.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002147' } };
  titulo.alignment = { vertical: 'middle', horizontal: 'center' };
  hoja.getRow(1).height = 26;

  const cabecera = hoja.addRow([
    'Apellidos',
    'Nombres',
    'DNI',
    'Grado',
    'Sección',
    'Fecha',
    'Estado',
    'Hora',
  ]);
  cabecera.height = 19;
  cabecera.eachCell((celda) => {
    celda.font = { bold: true, size: 10, color: { argb: 'FF14171A' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F7F9' } };
    celda.alignment = { vertical: 'middle', horizontal: 'center' };
    celda.border = { bottom: { style: 'thin', color: { argb: 'FFD3D7DD' } } };
  });

  for (const fila of filas) {
    const estado = normalizarEstado(fila.estado);

    const registro = hoja.addRow([
      fila.apellidos,
      fila.nombres,
      fila.dni ?? '',
      fila.grado,
      fila.seccion,
      fila.fecha,
      ESTADOS[estado].label,
      fila.hora ?? '',
    ]);

    registro.height = 16;
    registro.eachCell((celda, columna) => {
      celda.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: RELLENO[estado] ?? 'FFFFFFFF' },
      };
      celda.alignment = { vertical: 'middle', horizontal: columna <= 2 ? 'left' : 'center' };
      celda.border = { bottom: { style: 'hair', color: { argb: 'FFE6E8EB' } } };
      celda.font = { size: 10 };
    });
  }

  // Congelar título y cabecera: sin esto, al bajar por un reporte de miles
  // de filas se pierde de vista qué columna es cuál.
  hoja.views = [{ state: 'frozen', ySplit: 2 }];
  hoja.autoFilter = { from: 'A2', to: 'H2' };

  const buffer = await libro.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `Asistencias_NSR_${desde}_${hasta}.xlsx`;
  enlace.click();
  URL.revokeObjectURL(url);
}
