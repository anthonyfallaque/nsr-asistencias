import { Router } from 'express';
import {
  AlumnaParamsSchema,
  AlumnaQuerySchema,
  RangoQuerySchema,
  RankingQuerySchema,
  estadisticasAlumna,
  rankingTardanzas,
  reporteRango,
} from '../controllers/reportes.controller.js';
import { exigirPasswordVigente, requireAuth } from '../middleware/auth.js';
import { limiteAutenticado } from '../middleware/rateLimit.js';
import { requireRol } from '../middleware/roles.js';
import { scopeSecciones } from '../middleware/scope.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(requireAuth);
router.use(exigirPasswordVigente);
router.use(limiteAutenticado);
router.use(requireRol('auxiliar', 'tutora', 'directora', 'admin'));
router.use(scopeSecciones);

router.get('/rango', validate({ query: RangoQuerySchema }), reporteRango);

router.get(
  '/alumna/:id',
  validate({ params: AlumnaParamsSchema, query: AlumnaQuerySchema }),
  estadisticasAlumna
);

router.get('/ranking-tardanzas', validate({ query: RankingQuerySchema }), rankingTardanzas);

export default router;
