import { conSavepoint, pool, withTx } from '../db.js';
import { errNoEncontrado } from '../errors/AppError.js';
import * as auditoria from '../repositories/auditoria.repo.js';
import * as repo from '../repositories/asistencias.repo.js';
import type { EstadoAsistencia, ResumenSeccion } from '../types/index.js';
import { configuracionVigente, hoyEnLima } from './horario.service.js';

// ── Escaneo en vivo ──────────────────────────────────────────

export interface ResultadoEscaneo {
  alumna: {
    nombres: string;
    apellidos: string;
    foto_url: string | null;
    grado: string;
    seccion: string;
  };
  estado: EstadoAsistencia | 'ya_registrada';
  hora_escaneo: string;
  nuevo: boolean;
}

/**
 * Registra la llegada de una alumna.
 *
 * El momento lo pone SIEMPRE el servidor: aceptar `scanned_at` del
 * cuerpo permitía falsificar la hora de llegada (y escribir en fechas
 * arbitrarias) con sólo editar la petición.
 */
export async function escanear(datos: {
  qrToken: string;
  registradoPor: string;
  ip?: string | null;
}): Promise<ResultadoEscaneo> {
  const config = await configuracionVigente();
  const alumna = await repo.buscarPorQr(datos.qrToken, null);

  if (!alumna) throw errNoEncontrado('QR no reconocido');

  const resultado = await repo.registrarEscaneo(pool, {
    alumnaId: alumna.id,
    momento: null, // NOW() del servidor
    horaEntrada: config.hora_entrada,
    tolerancia: config.minutos_tolerancia,
    origen: 'escaneo',
    registradoPor: datos.registradoPor,
    ip: datos.ip,
  });

  return {
    alumna: {
      nombres: alumna.nombres,
      apellidos: alumna.apellidos,
      foto_url: alumna.foto_url,
      grado: alumna.grado,
      seccion: alumna.seccion,
    },
    estado: resultado.nuevo ? resultado.estado_calculado : 'ya_registrada',
    hora_escaneo: resultado.momento,
    nuevo: resultado.nuevo,
  };
}

// ── Sincronización de la cola offline ────────────────────────

export interface ElementoOffline {
  qr_token: string;
  scanned_at: string;
}

export interface ResultadoElemento {
  indice: number;
  ok: boolean;
  estado?: EstadoAsistencia | 'ya_registrada';
  alumna?: string;
  error?: string;
}

export interface ResultadoSync {
  procesados: number;
  correctos: number;
  fallidos: number;
  resultados: ResultadoElemento[];
}

/**
 * Vuelca la cola del lector cuando recupera conexión.
 *
 * Cada elemento se procesa por separado dentro de su propio savepoint:
 * antes, un único elemento malformado devolvía un 400 global y la cola
 * se atascaba para siempre porque el cliente reintentaba el lote entero.
 */
export async function sincronizarOffline(datos: {
  elementos: ElementoOffline[];
  registradoPor: string;
  ip?: string | null;
}): Promise<ResultadoSync> {
  const config = await configuracionVigente();

  return withTx(async (cx) => {
    const resultados: ResultadoElemento[] = [];
    const idsProcesados: string[] = [];

    for (const [indice, item] of datos.elementos.entries()) {
      try {
        const resultado = await conSavepoint(cx, `item_${indice}`, async () => {
          const alumna = await repo.buscarPorQr(item.qr_token, item.scanned_at, cx);

          if (!alumna) {
            return { indice, ok: false, error: 'qr_no_reconocido' } satisfies ResultadoElemento;
          }

          // El cliente sólo puede aportar la hora dentro de una ventana
          // razonable: 24 h hacia atrás y 5 min de holgura de reloj.
          if (!alumna.en_rango) {
            return { indice, ok: false, error: 'fecha_fuera_de_rango' } satisfies ResultadoElemento;
          }

          const idCola = await repo.encolarOffline(cx, {
            qrToken: item.qr_token,
            scannedAt: item.scanned_at,
            registradoPor: datos.registradoPor,
          });

          const registro = await repo.registrarEscaneo(cx, {
            alumnaId: alumna.id,
            momento: item.scanned_at,
            horaEntrada: config.hora_entrada,
            tolerancia: config.minutos_tolerancia,
            origen: 'offline',
            registradoPor: datos.registradoPor,
            ip: datos.ip,
          });

          // Se marca por id de fila, no por token: el mismo token vuelve
          // cada día y marcaba como procesados registros de otras fechas.
          if (idCola) idsProcesados.push(idCola);

          return {
            indice,
            ok: true,
            alumna: `${alumna.apellidos}, ${alumna.nombres}`,
            estado: registro.nuevo ? registro.estado_calculado : 'ya_registrada',
          } satisfies ResultadoElemento;
        });

        resultados.push(resultado);
      } catch (err) {
        console.error(`[sync-offline] Elemento ${indice} falló:`, err);
        resultados.push({ indice, ok: false, error: 'error_al_procesar' });
      }
    }

    await repo.marcarColaProcesada(cx, idsProcesados);

    const correctos = resultados.filter((r) => r.ok).length;

    await auditoria.registrar(cx, {
      usuarioId: datos.registradoPor,
      accion: 'asistencia_sync_offline',
      ip: datos.ip,
      contexto: {
        recibidos: datos.elementos.length,
        correctos,
        fallidos: resultados.length - correctos,
      },
    });

    return {
      procesados: resultados.length,
      correctos,
      fallidos: resultados.length - correctos,
      resultados,
    };
  });
}

// ── Consultas ────────────────────────────────────────────────

export async function resumen(
  fecha: string | undefined,
  ambito: number[] | null
): Promise<{ fecha: string; secciones: ResumenSeccion[] }> {
  const dia = fecha ?? hoyEnLima();
  return { fecha: dia, secciones: await repo.resumenPorSeccion(dia, ambito) };
}

export async function porSeccion(datos: {
  seccionId: number;
  fecha?: string;
  ambito: number[] | null;
}) {
  return repo.porSeccion({
    seccionId: datos.seccionId,
    fecha: datos.fecha ?? hoyEnLima(),
    ambito: datos.ambito,
  });
}

export async function tendencia(dias: number, ambito: number[] | null) {
  return repo.tendencia({ dias, ambito });
}

// ── Mutaciones ───────────────────────────────────────────────

/**
 * Guarda un estado de asistencia puesto a mano y deja constancia.
 *
 * `ausente` se escribe como fila real: borrarla, como se hacía antes,
 * destruía la trazabilidad (quién la marcó y cuándo) y además dejaba el
 * registro indistinguible de "nadie ha tocado esto todavía".
 */
async function guardar(datos: {
  alumnaId: string;
  fecha: string;
  estado: EstadoAsistencia;
  justificacion?: string | null;
  usuarioId: string;
  ip?: string | null;
  ambito: number[] | null;
  accion: 'asistencia_justificar' | 'asistencia_marcar_manual';
}) {
  return withTx(async (cx) => {
    const previo = await repo.estadoPrevio(cx, {
      alumnaId: datos.alumnaId,
      fecha: datos.fecha,
      ambito: datos.ambito,
    });

    // 404 y no 403: un 403 confirmaría que la alumna existe.
    if (!previo) throw errNoEncontrado('Alumna no encontrada');

    const guardada = await repo.guardarManual(cx, {
      alumnaId: datos.alumnaId,
      fecha: datos.fecha,
      estado: datos.estado,
      justificacion: datos.justificacion,
      registradoPor: datos.usuarioId,
      ip: datos.ip,
      ambito: datos.ambito,
    });

    if (!guardada) throw errNoEncontrado('Alumna no encontrada');

    await auditoria.registrar(cx, {
      usuarioId: datos.usuarioId,
      accion: datos.accion,
      ip: datos.ip,
      antes: previo.asistencia,
      despues: guardada,
      contexto: { alumna_id: datos.alumnaId, fecha: datos.fecha },
    });

    return guardada;
  });
}

export async function justificar(datos: {
  alumnaId: string;
  fecha: string;
  justificacion: string;
  usuarioId: string;
  ip?: string | null;
  ambito: number[] | null;
}) {
  return guardar({
    ...datos,
    estado: 'justificada',
    accion: 'asistencia_justificar',
  });
}

export async function marcarManual(datos: {
  alumnaId: string;
  fecha: string;
  estado: EstadoAsistencia;
  justificacion?: string;
  usuarioId: string;
  ip?: string | null;
  ambito: number[] | null;
}) {
  return guardar({
    ...datos,
    justificacion: datos.justificacion ?? null,
    accion: 'asistencia_marcar_manual',
  });
}
