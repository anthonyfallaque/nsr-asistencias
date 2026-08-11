/**
 * Validación del entorno al arrancar.
 *
 * Si falta JWT_SECRET el proceso arrancaba igual y firmaba tokens con
 * `undefined`; si faltaba DATABASE_URL fallaba en la primera consulta,
 * ya en producción. Mejor abortar aquí, con un mensaje claro.
 */
import 'dotenv/config';
import { z } from 'zod';

/** Zona horaria del colegio. Todo cálculo de fecha/hora se ancla aquí. */
export const ZONA_HORARIA = 'America/Lima';

const EntornoSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z
    .string()
    .url('DATABASE_URL debe ser una URL de conexión válida (postgresql://...)'),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET debe tener al menos 32 caracteres (openssl rand -base64 64)'),
  JWT_EXPIRES_IN: z.string().default('8h'),

  FRONTEND_URL: z.string().url('FRONTEND_URL debe ser una URL válida').default('http://localhost:5173'),

  TZ: z.string().default(ZONA_HORARIA),
  DB_SSL: z.enum(['true', 'false']).optional(),
});

export type Entorno = z.infer<typeof EntornoSchema>;

function cargar(): Entorno {
  const resultado = EntornoSchema.safeParse(process.env);

  if (!resultado.success) {
    console.error('\n[config] Configuración de entorno inválida:\n');
    for (const problema of resultado.error.issues) {
      console.error(`  · ${problema.path.join('.') || '(raíz)'}: ${problema.message}`);
    }
    console.error('\nRevisa backend/.env (ver backend/.env.example).\n');
    process.exit(1);
  }

  return resultado.data;
}

export const env = cargar();
