import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Field, Input, Modal, Select, useToast } from '@/shared/ui';
import { queryKeys } from '@/shared/lib/queryKeys';
import { ApiError } from '@/shared/lib/http';
import { alumnasApi } from '../api';

interface Errores {
  apellidos?: string;
  nombres?: string;
  seccion_id?: string;
  dni?: string;
}

export function NuevaAlumnaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [apellidos, setApellidos] = useState('');
  const [nombres, setNombres] = useState('');
  const [dni, setDni] = useState('');
  const [seccionId, setSeccionId] = useState('');
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState('');

  const idApellidos = useId();
  const idNombres = useId();
  const idDni = useId();
  const idSeccion = useId();

  const seccionesQuery = useQuery({
    queryKey: queryKeys.alumnas.secciones(),
    queryFn: () => alumnasApi.secciones(),
    staleTime: 10 * 60_000,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      alumnasApi.crear({
        apellidos: apellidos.trim(),
        nombres: nombres.trim(),
        seccion_id: Number(seccionId),
        ...(dni.trim() ? { dni: dni.trim() } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.alumnas.all });
      // Confirmar la acción es lo que distingue "guardado" de "no pasó nada".
      toast.success('Alumna registrada', `${apellidos.trim()}, ${nombres.trim()}`);
      limpiar();
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setErrores({ dni: 'Ya existe una alumna con ese DNI' });
      } else {
        setErrorGeneral(error instanceof Error ? error.message : 'No se pudo registrar');
      }
    },
  });

  function limpiar() {
    setApellidos('');
    setNombres('');
    setDni('');
    setSeccionId('');
    setErrores({});
    setErrorGeneral('');
  }

  function cerrar() {
    limpiar();
    onClose();
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErrorGeneral('');

    // Validar en el cliente evita un viaje al servidor para decir lo obvio,
    // pero el servidor vuelve a validar: esto es comodidad, no seguridad.
    const nuevos: Errores = {};
    if (!apellidos.trim()) nuevos.apellidos = 'Escribe los apellidos';
    if (!nombres.trim()) nuevos.nombres = 'Escribe los nombres';
    if (!seccionId) nuevos.seccion_id = 'Elige una sección';
    if (dni.trim() && !/^\d{8}$/.test(dni.trim())) {
      nuevos.dni = 'El DNI son 8 dígitos';
    }

    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    mutate();
  }

  const secciones = seccionesQuery.data ?? [];

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title="Nueva alumna"
      description="El código QR se genera automáticamente al registrarla."
      closeOnBackdrop={false}
      footer={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="form-nueva-alumna" loading={isPending}>
            Registrar
          </Button>
        </>
      }
    >
      <form id="form-nueva-alumna" onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field htmlFor={idApellidos} label="Apellidos" required error={errores.apellidos}>
            <Input
              id={idApellidos}
              value={apellidos}
              onChange={(e) => setApellidos(e.target.value)}
              placeholder="García López"
              invalid={Boolean(errores.apellidos)}
              aria-describedby={errores.apellidos ? `${idApellidos}-error` : undefined}
              autoFocus
            />
          </Field>

          <Field htmlFor={idNombres} label="Nombres" required error={errores.nombres}>
            <Input
              id={idNombres}
              value={nombres}
              onChange={(e) => setNombres(e.target.value)}
              placeholder="María Elena"
              invalid={Boolean(errores.nombres)}
              aria-describedby={errores.nombres ? `${idNombres}-error` : undefined}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            htmlFor={idDni}
            label="DNI"
            hint="Opcional, 8 dígitos"
            error={errores.dni}
          >
            <Input
              id={idDni}
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
              placeholder="12345678"
              inputMode="numeric"
              maxLength={8}
              invalid={Boolean(errores.dni)}
              aria-describedby={errores.dni ? `${idDni}-error` : `${idDni}-hint`}
            />
          </Field>

          <Field htmlFor={idSeccion} label="Sección" required error={errores.seccion_id}>
            <Select
              id={idSeccion}
              value={seccionId}
              onChange={(e) => setSeccionId(e.target.value)}
              invalid={Boolean(errores.seccion_id)}
              aria-describedby={errores.seccion_id ? `${idSeccion}-error` : undefined}
              disabled={seccionesQuery.isLoading}
            >
              <option value="">
                {seccionesQuery.isLoading ? 'Cargando…' : 'Seleccionar…'}
              </option>
              {secciones.map((seccion) => (
                <option key={seccion.id} value={seccion.id}>
                  {seccion.grado} &quot;{seccion.nombre}&quot;
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {errorGeneral && (
          <p role="alert" className="text-sm text-danger bg-danger-soft border border-danger-border rounded-md px-3 py-2">
            {errorGeneral}
          </p>
        )}
      </form>
    </Modal>
  );
}
