import { Ejecutor, afectadas, fila, filas, pool } from '../db.js';
import type { Rol, Usuario } from '../types/index.js';

const CAMPOS = `
  u.id, u.email, u.nombre, u.activo, u.debe_cambiar_password,
  r.nombre AS rol`;

export async function buscarPorId(id: string, ex: Ejecutor = pool): Promise<Usuario | null> {
  return fila<Usuario>(
    ex,
    `SELECT ${CAMPOS}
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
      WHERE u.id = $1`,
    [id]
  );
}

export interface UsuarioConHash extends Usuario {
  password_hash: string;
}

export async function buscarPorEmailConHash(
  email: string,
  ex: Ejecutor = pool
): Promise<UsuarioConHash | null> {
  return fila<UsuarioConHash>(
    ex,
    `SELECT ${CAMPOS}, u.password_hash
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
      WHERE lower(u.email) = lower($1)`,
    [email]
  );
}

export async function obtenerHash(id: string, ex: Ejecutor = pool): Promise<string | null> {
  const row = await fila<{ password_hash: string }>(
    ex,
    `SELECT password_hash FROM usuarios WHERE id = $1 AND activo = true`,
    [id]
  );
  return row?.password_hash ?? null;
}

export async function listar(ex: Ejecutor = pool): Promise<Usuario[]> {
  return filas<Usuario>(
    ex,
    `SELECT ${CAMPOS}, u.created_at
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
      ORDER BY u.activo DESC, u.nombre`
  );
}

/** Devuelve null si el rol indicado no existe (el SELECT no da filas). */
export async function crear(
  datos: {
    email: string;
    passwordHash: string;
    nombre: string;
    rol: Rol;
    debeCambiarPassword: boolean;
  },
  ex: Ejecutor = pool
): Promise<Usuario | null> {
  return fila<Usuario>(
    ex,
    `INSERT INTO usuarios (email, password_hash, nombre, rol_id, debe_cambiar_password)
     SELECT lower($1), $2, $3, r.id, $5
       FROM roles r
      WHERE r.nombre = $4
     RETURNING id, email, nombre, activo, debe_cambiar_password,
               (SELECT nombre FROM roles WHERE id = rol_id) AS rol`,
    [datos.email, datos.passwordHash, datos.nombre, datos.rol, datos.debeCambiarPassword]
  );
}

export interface CamposUsuario {
  nombre?: string;
  rol?: Rol;
  activo?: boolean;
  passwordHash?: string;
  debeCambiarPassword?: boolean;
}

export async function actualizar(
  id: string,
  campos: CamposUsuario,
  ex: Ejecutor = pool
): Promise<Usuario | null> {
  const sets: string[] = [];
  const params: unknown[] = [id];

  const push = (fragmento: string, valor: unknown): void => {
    params.push(valor);
    sets.push(fragmento.replace('$n', `$${params.length}`));
  };

  if (campos.nombre !== undefined) push('nombre = $n', campos.nombre);
  if (campos.activo !== undefined) push('activo = $n', campos.activo);
  if (campos.passwordHash !== undefined) push('password_hash = $n', campos.passwordHash);
  if (campos.debeCambiarPassword !== undefined)
    push('debe_cambiar_password = $n', campos.debeCambiarPassword);
  if (campos.rol !== undefined)
    push('rol_id = (SELECT id FROM roles WHERE nombre = $n)', campos.rol);

  if (sets.length === 0) return buscarPorId(id, ex);

  return fila<Usuario>(
    ex,
    `UPDATE usuarios SET ${sets.join(', ')}
      WHERE id = $1
     RETURNING id, email, nombre, activo, debe_cambiar_password,
               (SELECT nombre FROM roles WHERE id = rol_id) AS rol`,
    params
  );
}

export async function cambiarPassword(
  id: string,
  passwordHash: string,
  ex: Ejecutor = pool
): Promise<number> {
  return afectadas(
    ex,
    `UPDATE usuarios
        SET password_hash = $2, debe_cambiar_password = false
      WHERE id = $1 AND activo = true`,
    [id, passwordHash]
  );
}
