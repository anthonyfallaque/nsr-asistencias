/**
 * Genera la plantilla Excel para cargar el padrón de alumnas.
 *
 * Las columnas se corresponden con lo que valida el backend
 * (`AlumnaSchema`), pero GRADO y SECCIÓN se piden por su nombre —"3°", "A"—
 * y no por `seccion_id`: nadie debería tener que buscar un identificador
 * numérico de base de datos para escribir una fila.
 *
 *   node scripts/generar-plantilla.cjs
 */
const path = require('node:path');
const ExcelJS = require(path.join(__dirname, '..', 'frontend', 'node_modules', 'exceljs'));

const GRADOS = ['3°', '4°', '5°'];
const SECCIONES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

const NAVY = 'FF002147';
const GRIS = 'FFF6F7F9';
const BORDE = 'FFD3D7DD';

async function main() {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Sistema de Asistencias NSR';
  libro.created = new Date();

  const hoja = libro.addWorksheet('Alumnas', {
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  hoja.columns = [
    { key: 'apellidos', width: 30 },
    { key: 'nombres', width: 28 },
    { key: 'dni', width: 14 },
    { key: 'grado', width: 10 },
    { key: 'seccion', width: 12 },
  ];

  // Título
  hoja.mergeCells('A1:E1');
  const titulo = hoja.getCell('A1');
  titulo.value = 'Padrón de alumnas · I. E. Nuestra Señora del Rosario';
  titulo.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  titulo.alignment = { vertical: 'middle', horizontal: 'center' };
  hoja.getRow(1).height = 26;

  // Cabecera
  const cabecera = hoja.addRow(['APELLIDOS', 'NOMBRES', 'DNI', 'GRADO', 'SECCIÓN']);
  cabecera.height = 20;
  cabecera.eachCell((celda) => {
    celda.font = { bold: true, size: 10 };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } };
    celda.alignment = { vertical: 'middle', horizontal: 'center' };
    celda.border = { bottom: { style: 'thin', color: { argb: BORDE } } };
  });

  // Dos filas de ejemplo, marcadas para que se vea que hay que sustituirlas.
  const ejemplos = [
    ['García López', 'María Elena', '12345678', '3°', 'A'],
    ['Rodríguez Paz', 'Ana Lucía', '', '4°', 'B'],
  ];
  for (const fila of ejemplos) {
    const r = hoja.addRow(fila);
    r.eachCell((celda) => {
      celda.font = { size: 10, italic: true, color: { argb: 'FF9AA1AC' } };
    });
  }

  // Validación por lista en GRADO y SECCIÓN hasta la fila 1000: evita el
  // error más común de estas plantillas, que es escribir "3ro" o "3A".
  for (let fila = 3; fila <= 1002; fila++) {
    hoja.getCell(`D${fila}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`"${GRADOS.join(',')}"`],
      showErrorMessage: true,
      errorTitle: 'Grado no válido',
      error: 'Elige 3°, 4° o 5° de la lista.',
    };
    hoja.getCell(`E${fila}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`"${SECCIONES.join(',')}"`],
      showErrorMessage: true,
      errorTitle: 'Sección no válida',
      error: 'Elige una letra de la A a la I.',
    };
    // El DNI como texto: en formato numérico Excel se come los ceros a la
    // izquierda y un DNI que empieza por 0 llegaría con 7 dígitos.
    hoja.getCell(`C${fila}`).numFmt = '@';
  }

  // ── Hoja de instrucciones ─────────────────────────────────────────────
  const guia = libro.addWorksheet('Instrucciones');
  guia.columns = [{ width: 18 }, { width: 92 }];

  const filas = [
    ['', ''],
    ['CÓMO RELLENAR', ''],
    ['', ''],
    ['APELLIDOS', 'Obligatorio. Entre 2 y 100 caracteres. Ambos apellidos en la misma celda.'],
    ['NOMBRES', 'Obligatorio. Entre 2 y 100 caracteres.'],
    ['DNI', 'Opcional. Exactamente 8 dígitos, sin puntos ni espacios. Déjalo vacío si no lo tienes.'],
    ['GRADO', 'Obligatorio. Elige de la lista: 3°, 4° o 5°.'],
    ['SECCIÓN', 'Obligatorio. Elige de la lista: de la A a la I.'],
    ['', ''],
    ['IMPORTANTE', ''],
    ['', ''],
    ['', '· Borra las dos filas de ejemplo en gris antes de enviar el archivo.'],
    ['', '· Una alumna por fila. Máximo 1000 por archivo.'],
    ['', '· No cambies el orden ni el nombre de las columnas.'],
    ['', '· No dejes filas vacías en medio del listado.'],
    ['', '· El DNI debe ser único: si dos alumnas tienen el mismo, la segunda se rechaza.'],
    ['', '· El código QR de cada alumna se genera solo al importarla. No hay que rellenarlo.'],
    ['', ''],
    ['SI ALGO FALLA', ''],
    ['', ''],
    ['', 'La importación informa fila por fila: las correctas entran y las que fallan'],
    ['', 'se listan con el motivo, así que un error en una fila no tumba el resto.'],
  ];

  for (const [a, b] of filas) {
    const r = guia.addRow([a, b]);
    if (a && !b) {
      r.getCell(1).font = { bold: true, size: 11, color: { argb: NAVY } };
    } else if (a) {
      r.getCell(1).font = { bold: true, size: 10 };
      r.getCell(2).font = { size: 10 };
    } else {
      r.getCell(2).font = { size: 10 };
    }
    r.alignment = { vertical: 'middle' };
  }

  const destino = path.join(__dirname, '..', 'Plantilla_Alumnas_NSR.xlsx');
  await libro.xlsx.writeFile(destino);
  console.log('Plantilla generada: ' + destino);
}

main().catch((e) => {
  console.error('Error generando la plantilla:', e.message);
  process.exit(1);
});
