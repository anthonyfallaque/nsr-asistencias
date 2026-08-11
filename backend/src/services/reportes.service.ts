import { AppError, errNoEncontrado } from '../errors/AppError.js';
import * as repo from '../repositories/reportes.repo.js';
import type { EstadoAsistencia, Pagina } from '../types/index.js';
import { diasEntre, inicioMes, inicioMesSiguiente } from './horario.service.js';

/** Un rango mayor no cabe en una respuesta razonable ni en la memoria del proceso. */
export const MAX_DIAS_RANGO = 92;

export async function porRango(datos: {
  desde: string;
  hasta: string;
  grado?: string;
  seccionId?: number;
  ambito: number[] | null;
  pagina: number;
  porPagina: number;
}): Promise<Pagina<repo.FilaReporte>> {
  const dias = diasEntre(datos.desde, datos.hasta);

  if (dias < 0) {
    throw new AppError(400, 'RANGO_INVALIDO', 'La fecha "desde" debe ser anterior a "hasta"');
  }
  if (dias > MAX_DIAS_RANGO) {
    throw new AppError(
      400,
      'RANGO_DEMASIADO_AMPLIO',
      `El rango no puede superar los ${MAX_DIAS_RANGO} días (solicitados: ${dias})`
    );
  }

  const { filas, total } = await repo.reporteRango({
    desde: datos.desde,
    hasta: datos.hasta,
    grado: datos.grado,
    seccionId: datos.seccionId,
    ambito: datos.ambito,
    limite: datos.porPagina,
    desplazamiento: (datos.pagina - 1) * datos.porPagina,
  });

  return { datos: filas, total, pagina: datos.pagina, por_pagina: datos.porPagina };
}

export interface EstadisticasAlumna {
  total_dias: number;
  puntuales: number;
  tardanzas: number;
  justificadas: number;
  ausentes: number;
  detalle: repo.DiaAlumna[];
}

export async function estadisticasAlumna(datos: {
  alumnaId: string;
  mes: number;
  anio: number;
  ambito: number[] | null;
}): Promise<EstadisticasAlumna> {
  const dias = await repo.diasDeAlumna({
    alumnaId: datos.alumnaId,
    desde: inicioMes(datos.anio, datos.mes),
    hasta: inicioMesSiguiente(datos.anio, datos.mes),
    ambito: datos.ambito,
  });

  if (dias === null) throw errNoEncontrado('Alumna no encontrada');

  const contar = (estado: EstadoAsistencia) => dias.filter((d) => d.estado === estado).length;

  return {
    total_dias: dias.length,
    puntuales: contar('puntual'),
    tardanzas: contar('tardanza'),
    justificadas: contar('justificada'),
    ausentes: contar('ausente'),
    detalle: dias,
  };
}

export async function rankingTardanzas(datos: {
  desde: string;
  hasta: string;
  ambito: number[] | null;
  limite: number;
}) {
  if (diasEntre(datos.desde, datos.hasta) < 0) {
    throw new AppError(400, 'RANGO_INVALIDO', 'La fecha "desde" debe ser anterior a "hasta"');
  }
  return repo.rankingTardanzas(datos);
}
