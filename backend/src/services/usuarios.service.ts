import { randomBytes } from 'crypto';
import { withTx } from '../db.js';
import { AppError, errNoEncontrado } from '../errors/AppError.js';
import { invalidarCacheUsuario } from '../middleware/auth.js';
import * as auditoria from '../repositories/auditoria.repo.js';
import * as repo from '../repositories/usuarios.repo.js';
import type { Rol, Usuario } from '../types/index.js';
import { hashear } from './auth.service.js';

/**
 * Contraseña provisional legible pero no adivinable. Se muestra una
 * sola vez a quien da de alta; el usuario está obligado a cambiarla en
 * su primer acceso (`debe_cambiar_password`).
 */
export function generarPasswordProvisional(): string {
  // Sin caracteres ambiguos (O/0, l/1) para poder dictarla por teléfono.
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(16);
  let clave = '';
  for (const byte of bytes) clave += alfabeto[byte % alfabeto.length];
  return `${clave}!7`; // garantiza símbolo y dígito
}

export async function listar(): Promise<Usuario[]> {
  return repo.listar();
}

export async function crear(datos: {
  email: string;
  nombre: string;
  rol: Rol;
  password?: string;
  creadoPor: string;
  ip?: string | null;
}): Promise<{ usuario: Usuario; password_provisional?: string }> {
  // Se calcula primero la contraseña efectiva y de ahí se deriva si fue
  // provisional. Al revés obligaba a una aserción para convencer a
  // TypeScript de que `provisional` existía cuando `password` no.
  const password = datos.password ?? generarPasswordProvisional();
  const provisional = datos.password ? undefined : password;

  return withTx(async (cx) => {
    const usuario = await repo.crear(
      {
        email: datos.email,
        passwordHash: await hashear(password),
        nombre: datos.nombre,
        rol: datos.rol,
        // Si la contraseña la elige el administrador, el usuario debe
        // cambiarla igualmente: nadie más debe conocerla.
        debeCambiarPassword: true,
      },
      cx
    );

    if (!usuario) throw new AppError(422, 'ROL_INVALIDO', 'El rol indicado no existe');

    await auditoria.registrar(cx, {
      usuarioId: datos.creadoPor,
      accion: 'usuario_crear',
      ip: datos.ip,
      antes: null,
      despues: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
      },
    });

    return { usuario, password_provisional: provisional };
  });
}

export async function actualizar(datos: {
  id: string;
  campos: { nombre?: string; rol?: Rol; activo?: boolean; restablecer_password?: boolean };
  actualizadoPor: string;
  ip?: string | null;
}): Promise<{ usuario: Usuario; password_provisional?: string }> {
  // Un administrador no debe poder desactivarse a sí mismo y dejar el
  // sistema sin nadie que pueda entrar a arreglarlo.
  if (datos.id === datos.actualizadoPor && datos.campos.activo === false) {
    throw new AppError(422, 'AUTODESACTIVACION', 'No puedes desactivar tu propio usuario');
  }
  if (datos.id === datos.actualizadoPor && datos.campos.rol !== undefined) {
    throw new AppError(422, 'AUTOCAMBIO_ROL', 'No puedes cambiar tu propio rol');
  }

  return withTx(async (cx) => {
    const antes = await repo.buscarPorId(datos.id, cx);
    if (!antes) throw errNoEncontrado('Usuario no encontrado');

    // Restablecer genera una contraseña provisional que se muestra una
    // sola vez a quien la restablece; el usuario está obligado a
    // cambiarla en su siguiente acceso.
    const restablecer = datos.campos.restablecer_password === true;
    const provisional = restablecer ? generarPasswordProvisional() : undefined;

    const despues = await repo.actualizar(
      datos.id,
      {
        nombre: datos.campos.nombre,
        rol: datos.campos.rol,
        activo: datos.campos.activo,
        passwordHash: provisional ? await hashear(provisional) : undefined,
        debeCambiarPassword: restablecer ? true : undefined,
      },
      cx
    );

    if (!despues) throw errNoEncontrado('Usuario no encontrado');

    await auditoria.registrar(cx, {
      usuarioId: datos.actualizadoPor,
      accion: 'usuario_actualizar',
      ip: datos.ip,
      antes,
      despues,
      contexto: { usuario_id: datos.id, password_restablecida: restablecer },
    });

    // El cambio debe notarse ya, no en 45 s.
    invalidarCacheUsuario(datos.id);

    return { usuario: despues, password_provisional: provisional };
  });
}
