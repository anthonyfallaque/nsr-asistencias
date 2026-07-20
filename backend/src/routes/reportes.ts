import { Router } from 'express';
import { reporteRango, estadisticasAlumna, rankingTardanzas } from '../controllers/reportes.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRol } from '../middleware/roles.js';

const router = Router();

router.use(requireAuth);
router.use(requireRol('auxiliar', 'tutora', 'directora', 'admin'));

router.get('/rango',              reporteRango);
router.get('/alumna/:id',         estadisticasAlumna);
router.get('/ranking-tardanzas',  rankingTardanzas);

export default router;
