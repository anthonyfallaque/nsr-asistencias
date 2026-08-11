import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import asistenciasRoutes from './routes/asistencias.js';
import alumnasRoutes from './routes/alumnas.js';
import reportesRoutes from './routes/reportes.js';
import usuariosRoutes from './routes/usuarios.js';
import { errorHandler, noEncontradoHandler } from './middleware/errorHandler.js';
import { limiteGlobal } from './middleware/rateLimit.js';
import { pool } from './db.js';

const app = express();

app.set('trust proxy', 1);

// ── Seguridad ────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

// ── Health check ─────────────────────────────────────────────
// Va antes del rate limit: los monitores externos y el health check
// de Render no deben consumir el presupuesto de peticiones.
async function healthCheck(_req: express.Request, res: express.Response): Promise<void> {
  const inicio = Date.now();
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      db: { conectada: true, latencia_ms: Date.now() - inicio },
      uptime_s: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    // El código (XX000, ECONNREFUSED, ETIMEDOUT...) basta para diagnosticar
    // sin exponer host ni tenant en un endpoint público. El detalle va al log.
    const e = err as { code?: string; message?: string };
    console.error('[health] DB inaccesible:', e.code ?? '(sin code)', '|', e.message);
    res.status(503).json({
      status: 'error',
      db: { conectada: false, codigo: e.code ?? null, latencia_ms: Date.now() - inicio },
      uptime_s: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }
}

app.get('/health', healthCheck);
app.get('/api/health', healthCheck);

// ── Rate limiting ────────────────────────────────────────────
// El escaneo queda excluido de este limitador y lleva el suyo, mucho
// más holgado y contado por usuario: el colegio sale por una única IP.
app.use(limiteGlobal);

// ── Parsers ──────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── Rutas ────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/asistencias', asistenciasRoutes);
app.use('/api/alumnas', alumnasRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/usuarios', usuariosRoutes);

// ── 404 y errores ────────────────────────────────────────────
app.use(noEncontradoHandler);
app.use(errorHandler);

const servidor = app.listen(env.PORT, () => {
  console.log(`[API] Servidor corriendo en http://localhost:${env.PORT}`);
  console.log(`[API] Entorno: ${env.NODE_ENV} · Zona horaria: ${process.env.TZ ?? '(sin TZ)'}`);
});

// ── Apagado ordenado ─────────────────────────────────────────
// Render manda SIGTERM en cada despliegue: sin esto, las peticiones en
// vuelo se cortan a medias y alguna asistencia podría perderse.
for (const senal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(senal, () => {
    console.log(`[API] ${senal} recibida, cerrando...`);
    servidor.close(() => {
      pool.end().then(
        () => process.exit(0),
        () => process.exit(1)
      );
    });
  });
}
