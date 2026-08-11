import { randomBytes } from 'crypto';
import QRCode from 'qrcode';
import { conSavepoint, pool, withTx } from '../db.js';
import { errNoEncontrado, errNoProcesable } from '../errors/AppError.js';
import * as repo from '../repositories/alumnas.repo.js';
import * as auditoria from '../repositories/auditoria.repo.js';
import * as seccionesRepo from '../repositories/secciones.repo.js';
import type { Pagina } from '../types/index.js';

/** Token opaco de 48 caracteres: nunca contiene datos personales. */
function nuevoToken(): string {
  return randomBytes(24).toString('hex');
}

export async function listar(filtros: {
  grado?: string;
  seccionId?: number;
  buscar?: string;
  ambito: number[] | null;
  pagina: number;
  porPagina: number;
}): Promise<Pagina<repo.AlumnaListada>> {
  const { filas, total } = await repo.listar({
    grado: filtros.grado,
    seccionId: filtros.seccionId,
    buscar: filtros.buscar,
    ambito: filtros.ambito,
    limite: filtros.porPagina,
    desplazamiento: (filtros.pagina - 1) * filtros.porPagina,
  });

  return { datos: filas, total, pagina: filtros.pagina, por_pagina: filtros.porPagina };
}

export async function crear(datos: {
  nombres: string;
  apellidos: string;
  dni?: string;
  seccion_id: number;
  foto_url?: string;
  usuarioId: string;
  ip?: string | null;
}) {
  return withTx(async (cx) => {
    if (!(await repo.existeSeccion(cx, datos.seccion_id))) {
      throw errNoProcesable('La sección indicada no existe');
    }

    const creada = await repo.crear(cx, {
      nombres: datos.nombres,
      apellidos: datos.apellidos,
      dni: datos.dni ?? null,
      seccionId: datos.seccion_id,
      fotoUrl: datos.foto_url ?? null,
      qrToken: nuevoToken(),
    });

    if (!creada) throw errNoProcesable('No se pudo dar de alta a la alumna');

    await auditoria.registrar(cx, {
      usuarioId: datos.usuarioId,
      accion: 'alumna_crear',
      ip: datos.ip,
      antes: null,
      despues: {
        id: creada.id,
        nombres: datos.nombres,
        apellidos: datos.apellidos,
        dni: datos.dni ?? null,
        seccion_id: datos.seccion_id,
      },
    });

    return creada;
  });
}

export async function obtenerQr(id: string, ambito: number[] | null) {
  const alumna = await repo.datosQr(id, ambito);
  if (!alumna) throw errNoEncontrado('Alumna no encontrada');

  const qrDataUrl = await QRCode.toDataURL(alumna.qr_token, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: 'H',
  });

  return {
    qr_image: qrDataUrl,
    nombre_completo: `${alumna.apellidos}, ${alumna.nombres}`,
    grado: alumna.grado,
    seccion: alumna.seccion,
  };
}

export async function actualizar(datos: {
  id: string;
  campos: repo.CamposAlumna;
  ambito: number[] | null;
  usuarioId: string;
  ip?: string | null;
}) {
  return withTx(async (cx) => {
    const antes = await repo.buscarPorId(datos.id, datos.ambito, cx);
    if (!antes) throw errNoEncontrado('Alumna no encontrada');

    if (
      datos.campos.seccion_id !== undefined &&
      !(await repo.existeSeccion(cx, datos.campos.seccion_id))
    ) {
      throw errNoProcesable('La sección indicada no existe');
    }

    const despues = await repo.actualizar(cx, datos.id, datos.campos, datos.ambito);
    if (!despues) throw errNoEncontrado('Alumna no encontrada');

    await auditoria.registrar(cx, {
      usuarioId: datos.usuarioId,
      accion: 'alumna_actualizar',
      ip: datos.ip,
      antes,
      despues,
      contexto: { alumna_id: datos.id },
    });

    return despues;
  });
}

export async function desactivar(datos: {
  id: string;
  ambito: number[] | null;
  usuarioId: string;
  ip?: string | null;
}) {
  return withTx(async (cx) => {
    const antes = await repo.buscarPorId(datos.id, datos.ambito, cx);

    // Antes se devolvía ok:true aunque el id no existiera.
    if (!antes || !antes.activa) throw errNoEncontrado('Alumna no encontrada');

    const afectadas = await repo.desactivar(cx, datos.id, datos.ambito);
    if (afectadas === 0) throw errNoEncontrado('Alumna no encontrada');

    await auditoria.registrar(cx, {
      usuarioId: datos.usuarioId,
      accion: 'alumna_desactivar',
      ip: datos.ip,
      antes,
      despues: { ...antes, activa: false },
      contexto: { alumna_id: datos.id },
    });
  });
}

export interface ResultadoImportacion {
  indice: number;
  dni?: string;
  ok: boolean;
  creada?: boolean;
  error?: string;
}

/**
 * Importación masiva desde CSV/JSON.
 *
 * Todo el lote va en una transacción, pero cada fila se aísla con su
 * propio savepoint: una fila mala no revierte las buenas ni aborta el
 * proceso, y el detalle vuelve por elemento.
 */
export async function importarLote(datos: {
  alumnas: Array<{
    nombres: string;
    apellidos: string;
    dni?: string;
    seccion_id: number;
    foto_url?: string;
  }>;
  usuarioId: string;
  ip?: string | null;
}) {
  return withTx(async (cx) => {
    const resultados: ResultadoImportacion[] = [];

    for (const [indice, alumna] of datos.alumnas.entries()) {
      try {
        const resultado = await conSavepoint(cx, `alumna_${indice}`, async () => {
          if (!(await repo.existeSeccion(cx, alumna.seccion_id))) {
            return { indice, dni: alumna.dni, ok: false, error: 'seccion_inexistente' };
          }

          const creada = await repo.crearSiNoExiste(cx, {
            nombres: alumna.nombres,
            apellidos: alumna.apellidos,
            dni: alumna.dni ?? null,
            seccionId: alumna.seccion_id,
            fotoUrl: alumna.foto_url ?? null,
            qrToken: nuevoToken(),
          });

          return {
            indice,
            dni: alumna.dni,
            ok: true,
            // null = el DNI ya existía; no es un error, no se duplica.
            creada: creada !== null,
          };
        });

        resultados.push(resultado);
      } catch (err) {
        // El detalle real va al log; al cliente sólo un código estable.
        // Antes se devolvía String(e), que filtraba el mensaje crudo de
        // Postgres (tabla, columna y restricción incluidas).
        console.error(`[importar-lote] Fila ${indice} falló:`, err);
        resultados.push({ indice, dni: alumna.dni, ok: false, error: 'error_al_insertar' });
      }
    }

    const creadas = resultados.filter((r) => r.ok && r.creada).length;
    const omitidas = resultados.filter((r) => r.ok && !r.creada).length;
    const fallidas = resultados.filter((r) => !r.ok).length;

    await auditoria.registrar(cx, {
      usuarioId: datos.usuarioId,
      accion: 'alumna_importar_lote',
      ip: datos.ip,
      contexto: { recibidas: datos.alumnas.length, creadas, omitidas, fallidas },
    });

    return { total: datos.alumnas.length, creadas, omitidas, fallidas, resultados };
  });
}

// ── Catálogos ────────────────────────────────────────────────

export async function listarGrados() {
  return seccionesRepo.listarGrados(pool);
}

export async function listarSecciones(gradoId: number | undefined, ambito: number[] | null) {
  return seccionesRepo.listarSecciones({ gradoId, ambito });
}
