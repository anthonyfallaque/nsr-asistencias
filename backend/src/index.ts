import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import asistenciasRoutes from './routes/asistencias.js';
import alumnasRoutes from './routes/alumnas.js';
import reportesRoutes from './routes/reportes.js';
import { pool } from './db.js';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.set('trust proxy', 1);

// ── Seguridad ────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}));

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

// Rate limiting global
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Rate limit estricto para login
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos. Intenta en 15 minutos.' },
});

// ── Parsers ──────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── Rutas ────────────────────────────────────────────────────
app.use('/api/auth', loginLimit, authRoutes);
app.use('/api/asistencias', asistenciasRoutes);
app.use('/api/alumnas', alumnasRoutes);
app.use('/api/reportes', reportesRoutes);

// ── 404 ──────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// ── Error handler ────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`[API] Servidor corriendo en http://localhost:${PORT}`);
});
