import { Router } from 'express';
import {
  listar,
  crear,
  actualizar,
  desactivar,
  obtenerQR,
  importarLote,
  listarGrados,
  listarSecciones,
} from '../controllers/alumnas.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRol } from '../middleware/roles.js';

const router = Router();

router.use(requireAuth);

router.get('/grados',   listarGrados);
router.get('/secciones', listarSecciones);

router.get('/',         requireRol('auxiliar', 'tutora', 'directora', 'admin'), listar);
router.post('/',        requireRol('admin'), crear);
router.post('/importar', requireRol('admin'), importarLote);
router.get('/:id/qr',  requireRol('admin', 'auxiliar', 'directora'), obtenerQR);
router.put('/:id',     requireRol('admin'), actualizar);
router.delete('/:id',  requireRol('admin'), desactivar);

export default router;
