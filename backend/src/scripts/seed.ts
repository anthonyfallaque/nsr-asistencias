/**
 * Seed: crea usuario admin inicial y usuarios de ejemplo.
 * Ejecutar UNA sola vez: npm run db:seed
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query, pool } from '../db.js';

async function seed() {
  console.log('Ejecutando seed...');

  const adminHash = await bcrypt.hash('Admin1234!', 12);
  const porteroHash = await bcrypt.hash('Portero123!', 12);

  // Admin
  await query(
    `INSERT INTO usuarios (email, password_hash, nombre, rol_id)
     VALUES ($1, $2, $3, (SELECT id FROM roles WHERE nombre = 'admin'))
     ON CONFLICT (email) DO NOTHING`,
    ['admin@nsr.edu.pe', adminHash, 'Administrador Sistema']
  );

  // Portero
  await query(
    `INSERT INTO usuarios (email, password_hash, nombre, rol_id)
     VALUES ($1, $2, $3, (SELECT id FROM roles WHERE nombre = 'portero'))
     ON CONFLICT (email) DO NOTHING`,
    ['portero@nsr.edu.pe', porteroHash, 'Portero Principal']
  );

  console.log('✓ Usuarios creados');
  console.log('  admin@nsr.edu.pe   / Admin1234!');
  console.log('  portero@nsr.edu.pe / Portero123!');
  console.log('\n⚠️  Cambia estas contraseñas en producción.');

  await pool.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
