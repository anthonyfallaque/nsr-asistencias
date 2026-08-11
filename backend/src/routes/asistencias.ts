import { Router } from 'express';
import {
  EscaneoSchema,
  JustificarSchema,
  MarcarManualSchema,
  ResumenQuerySchema,
  SeccionParamsSchema,
  SeccionQuerySchema,
  SyncSchema,
  TendenciaQuerySchema,
  asistenciasSeccion,
  escanear,
  justificar,
  marcarManual,
  resumen,
  sincronizarOffline,
  tendencia,
} from '../controllers/asistencias.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { limiteAutenticado, limiteEscaneo } from '../middleware/rateLimit.js';
import { requireRol } from '../middleware/roles.js';
import { scopeSecciones } from '../middleware/scope.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(requireAuth);
router.use(scopeSecciones);

// Portero: escanear QR.
// El limitador va aquí, tras requireAuth, para poder contar por usuario
// y no por la IP única del colegio.
router.post(
  '/escanear',
  limiteEscaneo,
  requireRol('portero', 'auxiliar', 'admin'),
  validate({ body: EscaneoSchema }),
  escanear
);

// Portero: volcar la cola offline
router.post(
  '/sync-offline',
  limiteEscaneo,
  requireRol('portero', 'auxiliar', 'admin'),
  validate({ body: SyncSchema }),
  sincronizarOffline
);

// El resto del router sí lleva el límite normal por usuario.
// Se declara después del escaneo para no contarlo dos veces.
router.use(limiteAutenticado);

// Panel: resumen por sección de una fecha (por defecto hoy en Lima)
router.get(
  '/resumen',
  requireRol('auxiliar', 'tutora', 'directora', 'admin'),
  validate({ query: ResumenQuerySchema }),
  resumen
);

// Panel: tendencia de los últimos N días
router.get(
  '/tendencia',
  requireRol('auxiliar', 'tutora', 'directora', 'admin'),
  validate({ query: TendenciaQuerySchema }),
  tendencia
);

// Asistencias de una sección (fecha opcional, por defecto hoy)
router.get(
  '/seccion/:seccionId',
  requireRol('auxiliar', 'tutora', 'directora', 'admin'),
  validate({ params: SeccionParamsSchema, query: SeccionQuerySchema }),
  asistenciasSeccion
);

// Auxiliar/tutora: justificar una ausencia
router.post(
  '/justificar',
  requireRol('auxiliar', 'tutora', 'directora', 'admin'),
  validate({ body: JustificarSchema }),
  justificar
);

// Auxiliar/tutora: marcar asistencia a mano (cualquier estado)
router.post(
  '/marcar-manual',
  requireRol('auxiliar', 'tutora', 'directora', 'admin'),
  validate({ body: MarcarManualSchema }),
  marcarManual
);

export default router;
