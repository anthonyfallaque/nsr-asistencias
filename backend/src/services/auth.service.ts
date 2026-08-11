import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { withTx } from '../db.js';
import { env } from '../config/env.js';
import { AppError, errNoAutenticado, errNoEncontrado } from '../errors/AppError.js';
import { invalidarCacheUsuario } from '../middleware/auth.js';
import * as auditoria from '../repositories/auditoria.repo.js';
import * as usuariosRepo from '../repositories/usuarios.repo.js';
import type { JwtPayload, Usuario } from '../types/index.js';

export const COSTE_BCRYPT = 12;

export async function hashear(password: string): Promise<string> {
  return bcrypt.hash(password, COSTE_BCRYPT);
}

export interface SesionIniciada {
  token: string;
  usuario: {
    id: string;
    email: string;
    nombre: string;
    rol: string;
    debe_cambiar_password: boolean;
  };
}

export async function login(datos: {
  email: string;
  password: string;
  ip?: string | null;
}): Promise<SesionIniciada> {
  const fila = await usuariosRepo.buscarPorEmailConHash(datos.email);

  // Se compara igualmente contra un hash ficticio cuando el usuario no
  // existe: si no, el tiempo de respuesta delata qué emails son reales.
  const hash =
    fila?.password_hash ?? '$2a$12$invalidoinvalidoinvalidoinvalidoinvalidoinvalidoinvalidoinv';
  const coincide = await bcrypt.compare(datos.password, hash);

  if (!fila || !fila.activo || !coincide) {
    throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'Credenciales inválidas');
  }

  const payload: JwtPayload = { sub: fila.id, email: fila.email, rol: fila.rol };
  const token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  await withTx(async (cx) => {
    await auditoria.registrar(cx, {
      usuarioId: fila.id,
      accion: 'login',
      ip: datos.ip,
      contexto: { email: fila.email },
    });
  });

  return {
    token,
    usuario: {
      id: fila.id,
      email: fila.email,
      nombre: fila.nombre,
      rol: fila.rol,
      debe_cambiar_password: fila.debe_cambiar_password,
    },
  };
}

export async function perfil(id: string): Promise<Usuario> {
  const usuario = await usuariosRepo.buscarPorId(id);
  if (!usuario || !usuario.activo) throw errNoEncontrado('Usuario no encontrado');
  return usuario;
}

export async function cambiarPassword(datos: {
  usuarioId: string;
  actual: string;
  nueva: string;
  ip?: string | null;
}): Promise<void> {
  const hashActual = await usuariosRepo.obtenerHash(datos.usuarioId);
  if (!hashActual) throw errNoAutenticado('La sesión ya no es válida.');

  if (!(await bcrypt.compare(datos.actual, hashActual))) {
    throw new AppError(
      400,
      'PASSWORD_ACTUAL_INCORRECTA',
      'La contraseña actual no es correcta'
    );
  }

  if (await bcrypt.compare(datos.nueva, hashActual)) {
    throw new AppError(
      400,
      'PASSWORD_REPETIDA',
      'La nueva contraseña debe ser distinta de la actual'
    );
  }

  await withTx(async (cx) => {
    const afectadas = await usuariosRepo.cambiarPassword(
      datos.usuarioId,
      await hashear(datos.nueva),
      cx
    );
    if (afectadas === 0) throw errNoEncontrado('Usuario no encontrado');

    await auditoria.registrar(cx, {
      usuarioId: datos.usuarioId,
      accion: 'cambiar_password',
      ip: datos.ip,
      contexto: { usuario_id: datos.usuarioId },
    });
  });

  // El usuario en caché lleva debe_cambiar_password desactualizado.
  invalidarCacheUsuario(datos.usuarioId);
}
