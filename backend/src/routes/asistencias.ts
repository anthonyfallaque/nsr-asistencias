import { Router } from 'express';
import {
  escanear,
  sincronizarOffline,
  resumenHoy,
  asistenciasSeccion,
  justificar,
  tendencia,
  marcarManual,
} from '../controllers/asistencias.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRol } from '../middleware/roles.js';

const router = Router();

router.use(requireAuth);

// Portero: escanear QR
router.post('/escanear', requireRol('portero', 'auxiliar', 'admin'), escanear);

// Portero: sincronizar cola offline
router.post('/sync-offline', requireRol('portero', 'auxiliar', 'admin'), sincronizarOffline);

// Dashboard: resumen del día por sección
router.get('/resumen', requireRol('auxiliar', 'tutora', 'directora', 'admin'), resumenHoy);

// Dashboard: tendencia últimos N días
router.get('/tendencia', requireRol('auxiliar', 'tutora', 'directora', 'admin'), tendencia);

// Asistencias de una sección (fecha opcional, default hoy)
router.get('/seccion/:seccionId', requireRol('auxiliar', 'tutora', 'directora', 'admin'), asistenciasSeccion);

// Auxiliar/tutora: justificar ausencia
router.post('/justificar', requireRol('auxiliar', 'tutora', 'directora', 'admin'), justificar);

// Auxiliar/tutora: marcar asistencia manual (cualquier estado)
router.post('/marcar-manual', requireRol('auxiliar', 'tutora', 'directora', 'admin'), marcarManual);

export default router;
