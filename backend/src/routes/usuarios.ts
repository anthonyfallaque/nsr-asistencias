import { Router } from 'express';
import {
  ActualizarUsuarioSchema,
  CrearUsuarioSchema,
  IdParamsSchema,
  actualizar,
  crear,
  listar,
} from '../controllers/usuarios.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRol } from '../middleware/roles.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Gestión de personal: sólo administración.
router.use(requireAuth);
router.use(requireRol('admin'));

router.get('/', listar);

router.post('/', validate({ body: CrearUsuarioSchema }), crear);

router.patch(
  '/:id',
  validate({ params: IdParamsSchema, body: ActualizarUsuarioSchema }),
  actualizar
);

export default router;
