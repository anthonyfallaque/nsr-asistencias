/**
 * Seed: crea las cuentas iniciales con contraseñas aleatorias.
 *
 * Las contraseñas se imprimen UNA sola vez por consola y nadie más las
 * conoce: publicarlas en el repositorio, como se hacía antes con
 * `admin@nsr.edu.pe / Admin1234!`, equivale a no tener contraseña.
 * Ambas cuentas quedan obligadas a cambiarla en el primer acceso.
 *
 * Ejecutar: npm run db:seed
 */
import 'dotenv/config';
import { pool, queryOne, withTx } from '../db.js';
import { hashear } from '../services/auth.service.js';
import { generarPasswordProvisional } from '../services/usuarios.service.js';
import type { Rol } from '../types/index.js';

interface CuentaInicial {
  email: string;
  nombre: string;
  rol: Rol;
}

const CUENTAS: CuentaInicial[] = [
  { email: 'admin@nsr.edu.pe', nombre: 'Administrador Sistema', rol: 'admin' },
  { email: 'portero@nsr.edu.pe', nombre: 'Portero Principal', rol: 'portero' },
];

async function seed(): Promise<void> {
  console.log('Ejecutando seed...\n');

  const creadas: Array<{ email: string; password: string }> = [];
  const existentes: string[] = [];

  for (const cuenta of CUENTAS) {
    const password = generarPasswordProvisional();

    const creada = await withTx(async (cx) => {
      const resultado = await cx.query(
        `INSERT INTO usuarios (email, password_hash, nombre, rol_id, debe_cambiar_password)
         SELECT $1, $2, $3, r.id, true
           FROM roles r
          WHERE r.nombre = $4
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [cuenta.email, await hashear(password), cuenta.nombre, cuenta.rol]
      );
      return (resultado.rowCount ?? 0) > 0;
    });

    if (creada) creadas.push({ email: cuenta.email, password });
    else existentes.push(cuenta.email);
  }

  if (creadas.length > 0) {
    console.log('Cuentas creadas. Anota estas contraseñas AHORA: no vuelven a mostrarse.\n');
    for (const { email, password } of creadas) {
      console.log(`  ${email.padEnd(22)} ${password}`);
    }
    console.log('\nCada usuario deberá cambiarla en su primer acceso');
    console.log('(POST /api/auth/cambiar-password).');
  }

  if (existentes.length > 0) {
    console.log(`\nYa existían y no se han tocado: ${existentes.join(', ')}`);
    console.log('Para restablecer una contraseña: PATCH /api/usuarios/:id');
    console.log('con { "restablecer_password": true } desde una cuenta de administración.');
  }

  // Aviso si no hay configuración de horario: sin ella el registro de
  // asistencias falla de forma explícita.
  const config = await queryOne(`SELECT id FROM configuracion_horario WHERE activo = true`);
  if (!config) {
    console.log('\nAVISO: no hay configuración de horario activa.');
    console.log('Inserta una en configuracion_horario antes de registrar asistencias.');
  }

  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
