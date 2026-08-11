import { Router } from 'express';
import {
  CambiarPasswordSchema,
  LoginSchema,
  cambiarPassword,
  login,
  me,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { limiteCambioPassword, limiteLogin } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// El limitador va sólo en el login. Antes cubría todo /api/auth, así que
// el panel gastaba el presupuesto de intentos de contraseña llamando a
// /me y acababa echando a usuarios legítimos.
router.post('/login', limiteLogin, validate({ body: LoginSchema }), login);

router.get('/me', requireAuth, me);

router.post(
  '/cambiar-password',
  requireAuth,
  limiteCambioPassword,
  validate({ body: CambiarPasswordSchema }),
  cambiarPassword
);

export default router;
