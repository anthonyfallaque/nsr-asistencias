import { Router } from 'express';
import {
  ActualizarSchema,
  AlumnaSchema,
  IdParamsSchema,
  ImportSchema,
  ListarQuerySchema,
  SeccionesQuerySchema,
  actualizar,
  crear,
  desactivar,
  importarLote,
  listar,
  listarGrados,
  listarSecciones,
  obtenerQR,
} from '../controllers/alumnas.controller.js';
import { exigirPasswordVigente, requireAuth } from '../middleware/auth.js';
import { limiteAutenticado } from '../middleware/rateLimit.js';
import { requireRol } from '../middleware/roles.js';
import { scopeSecciones } from '../middleware/scope.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(requireAuth);
router.use(exigirPasswordVigente);
router.use(limiteAutenticado);
router.use(scopeSecciones);

// Catálogos. Antes iban sin requireRol: un portero podía enumerar todas
// las secciones y el nombre de cada tutora.
router.get('/grados', requireRol('auxiliar', 'tutora', 'directora', 'admin'), listarGrados);

router.get(
  '/secciones',
  requireRol('auxiliar', 'tutora', 'directora', 'admin'),
  validate({ query: SeccionesQuerySchema }),
  listarSecciones
);

router.get(
  '/',
  requireRol('auxiliar', 'tutora', 'directora', 'admin'),
  validate({ query: ListarQuerySchema }),
  listar
);

router.post('/', requireRol('admin'), validate({ body: AlumnaSchema }), crear);

router.post('/importar', requireRol('admin'), validate({ body: ImportSchema }), importarLote);

router.get(
  '/:id/qr',
  requireRol('admin', 'auxiliar', 'directora'),
  validate({ params: IdParamsSchema }),
  obtenerQR
);

router.put(
  '/:id',
  requireRol('admin'),
  validate({ params: IdParamsSchema, body: ActualizarSchema }),
  actualizar
);

router.delete('/:id', requireRol('admin'), validate({ params: IdParamsSchema }), desactivar);

export default router;
