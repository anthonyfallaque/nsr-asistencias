import { Request } from 'express';
import rateLimit, { Options } from 'express-rate-limit';

const VENTANA_MS = 15 * 60 * 1000;

/** Rutas de registro de asistencia: llevan su propio presupuesto. */
const RUTAS_ESCANEO = ['/api/asistencias/escanear', '/api/asistencias/sync-offline'];

/**
 * Clave de IPv6 reducida a su /64: si no, cada petición desde un cliente
 * IPv6 estrenaría dirección y el límite no contaría nada.
 */
function claveIp(req: Request): string {
  const ip = req.ip ?? 'desconocida';
  return ip.includes(':') ? ip.split(':').slice(0, 4).join(':') + '::/64' : ip;
}

/**
 * Por usuario autenticado cuando lo hay; por IP en el resto.
 *
 * El colegio sale a internet por una única IP (NAT), así que contar por
 * IP metía a las ~800 alumnas de la mañana en el mismo cubo.
 */
function claveUsuarioOIp(req: Request): string {
  return req.usuario ? `u:${req.usuario.id}` : `ip:${claveIp(req)}`;
}

function respuestaJson(mensaje: string): Partial<Options> {
  return {
    // Sin esto express-rate-limit responde texto plano y el cliente,
    // que hace res.json(), revienta al parsearlo.
    message: { codigo: 'DEMASIADAS_PETICIONES', mensaje, error: mensaje },
    standardHeaders: true,
    legacyHeaders: false,
  };
}

/**
 * Red de seguridad por IP para toda la API.
 *
 * Se aplica antes de autenticar, así que aquí todavía no hay usuario y
 * la clave sólo puede ser la IP. Como el colegio entero sale por una
 * sola IP (NAT), el techo tiene que dar cabida a todo el personal a la
 * vez; el control fino por usuario lo hace `limiteAutenticado` dentro de
 * cada router, ya con `req.usuario` resuelto.
 *
 * El escaneo queda excluido: con 200 peticiones/15 min, a partir de la
 * alumna 200 el portero recibía 429 y la asistencia se perdía sin más.
 */
export const limiteGlobal = rateLimit({
  windowMs: VENTANA_MS,
  max: 2000,
  keyGenerator: claveIp,
  skip: (req) => RUTAS_ESCANEO.some((ruta) => req.path.startsWith(ruta)),
  ...respuestaJson('Demasiadas peticiones. Espera unos minutos.'),
});

/**
 * Límite por usuario autenticado. Va dentro de cada router, después de
 * `requireAuth`, que es cuando existe `req.usuario`.
 */
export const limiteAutenticado = rateLimit({
  windowMs: VENTANA_MS,
  max: 1000,
  keyGenerator: claveUsuarioOIp,
  ...respuestaJson('Demasiadas peticiones. Espera unos minutos.'),
});

/**
 * Escaneo de QR. ~800 alumnas por mañana más reintentos y sincronizaciones,
 * contadas por usuario (el portero), no por la IP compartida del colegio.
 */
export const limiteEscaneo = rateLimit({
  windowMs: VENTANA_MS,
  max: 3000,
  keyGenerator: claveUsuarioOIp,
  ...respuestaJson('Demasiados escaneos seguidos. Espera unos segundos.'),
});

/**
 * Login: por IP, porque aquí todavía no hay usuario y es justo lo que se
 * intenta adivinar. Sólo sobre POST /login, no sobre todo /api/auth
 * (antes /me consumía el presupuesto de intentos de contraseña).
 */
export const limiteLogin = rateLimit({
  windowMs: VENTANA_MS,
  max: 10,
  keyGenerator: claveIp,
  skipSuccessfulRequests: true,
  ...respuestaJson('Demasiados intentos. Intenta en 15 minutos.'),
});

/** Cambio de contraseña: evita el sondeo de la contraseña actual. */
export const limiteCambioPassword = rateLimit({
  windowMs: VENTANA_MS,
  max: 10,
  keyGenerator: claveUsuarioOIp,
  ...respuestaJson('Demasiados intentos de cambio de contraseña. Espera 15 minutos.'),
});
