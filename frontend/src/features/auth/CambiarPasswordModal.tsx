import { useId, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Field, Input, Modal, useToast } from '@/shared/ui';
import { ApiError } from '@/shared/lib/http';
import { authApi, REGLAS_PASSWORD, validarPassword } from './api';
import { useAuth } from './store';

interface Errores {
  actual?: string;
  nueva?: string;
  repetida?: string;
}

/**
 * Cambio de contraseña.
 *
 * Hasta ahora no existía forma de cambiarla desde la aplicación: la única
 * vía era un UPDATE manual en Postgres con un hash bcrypt generado a mano.
 * Con las credenciales del seed publicadas en el repositorio, eso convertía
 * una contraseña conocida en una contraseña permanente.
 */
export function CambiarPasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const marcarCambiada = useAuth((s) => s.marcarPasswordCambiada);

  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [errores, setErrores] = useState<Errores>({});

  const idActual = useId();
  const idNueva = useId();
  const idRepetida = useId();

  const { mutate, isPending } = useMutation({
    mutationFn: () => authApi.cambiarPassword(actual, nueva),
    onSuccess: () => {
      marcarCambiada();
      toast.success('Contraseña actualizada');
      limpiar();
      onClose();
    },
    onError: (error) => {
      // 401 aquí significa "la contraseña actual no es correcta", no sesión
      // caducada: el interceptor global ya habría cerrado sesión en ese caso.
      if (error instanceof ApiError && (error.status === 400 || error.status === 401)) {
        setErrores({ actual: 'La contraseña actual no es correcta' });
      } else {
        setErrores({ nueva: error instanceof Error ? error.message : 'No se pudo cambiar' });
      }
    },
  });

  function limpiar() {
    setActual('');
    setNueva('');
    setRepetida('');
    setErrores({});
  }

  function cerrar() {
    limpiar();
    onClose();
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();

    const nuevos: Errores = {};
    if (!actual) nuevos.actual = 'Escribe tu contraseña actual';

    const fallo = validarPassword(nueva);
    if (fallo) nuevos.nueva = fallo;
    else if (nueva === actual) nuevos.nueva = 'La nueva contraseña debe ser distinta';

    if (repetida !== nueva) nuevos.repetida = 'Las contraseñas no coinciden';

    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    mutate();
  }

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title="Cambiar contraseña"
      description={REGLAS_PASSWORD.descripcion}
      size="sm"
      closeOnBackdrop={false}
      footer={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="form-password" loading={isPending}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="form-password" onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <Field htmlFor={idActual} label="Contraseña actual" required error={errores.actual}>
          <Input
            id={idActual}
            type="password"
            autoComplete="current-password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            invalid={Boolean(errores.actual)}
            aria-describedby={errores.actual ? `${idActual}-error` : undefined}
          />
        </Field>

        <Field htmlFor={idNueva} label="Nueva contraseña" required error={errores.nueva}>
          <Input
            id={idNueva}
            type="password"
            autoComplete="new-password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            invalid={Boolean(errores.nueva)}
            aria-describedby={errores.nueva ? `${idNueva}-error` : undefined}
          />
        </Field>

        <Field htmlFor={idRepetida} label="Repite la nueva" required error={errores.repetida}>
          <Input
            id={idRepetida}
            type="password"
            autoComplete="new-password"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
            invalid={Boolean(errores.repetida)}
            aria-describedby={errores.repetida ? `${idRepetida}-error` : undefined}
          />
        </Field>
      </form>
    </Modal>
  );
}
