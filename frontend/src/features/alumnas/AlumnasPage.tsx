import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, QrCode, Printer, Users } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Select,
  SkeletonRows,
} from '@/shared/ui';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useDisclosure } from '@/shared/hooks/useDisclosure';
import { queryKeys } from '@/shared/lib/queryKeys';
import { puede } from '@/config/navigation';
import { useRol } from '@/features/auth/store';
import { alumnasApi, extraerAlumnas, type Alumna } from './api';
import { NuevaAlumnaModal } from './components/NuevaAlumnaModal';
import { QRModal } from './components/QRModal';
import { CarnetsModal } from './components/CarnetsModal';

function FilaAlumna({ alumna, onVerQR }: { alumna: Alumna; onVerQR: (a: Alumna) => void }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors">
      <div className="h-8 w-8 rounded-md bg-surface-sunken border border-border flex items-center justify-center shrink-0">
        <span className="text-2xs font-semibold text-content-secondary">
          {alumna.apellidos.charAt(0).toUpperCase()}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-base text-content truncate">
          {alumna.apellidos}, {alumna.nombres}
        </p>
        <p className="text-xs text-content-muted truncate">
          {alumna.grado} &ldquo;{alumna.seccion}&rdquo;
          {alumna.dni && <span className="tabular-nums"> · {alumna.dni}</span>}
        </p>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onVerQR(alumna)}
        icon={<QrCode className="h-3.5 w-3.5" aria-hidden="true" />}
        aria-label={`Ver el código QR de ${alumna.apellidos}, ${alumna.nombres}`}
        className="shrink-0"
      >
        <span className="hidden sm:inline">QR</span>
      </Button>
    </li>
  );
}

export default function AlumnasPage() {
  const rol = useRol();
  const [busqueda, setBusqueda] = useState('');
  const [grado, setGrado] = useState('');
  const [qrAlumna, setQrAlumna] = useState<Alumna | null>(null);

  const nueva = useDisclosure();
  const carnets = useDisclosure();

  // Sin esto, la clave de consulta cambiaba en cada tecla y "Rodríguez"
  // disparaba nueve peticiones al servidor.
  const busquedaDiferida = useDebounce(busqueda, 350);

  const gradosQuery = useQuery({
    queryKey: queryKeys.alumnas.grados,
    queryFn: () => alumnasApi.grados(),
    staleTime: 10 * 60_000,
  });

  const filtros = {
    grado: grado || undefined,
    buscar: busquedaDiferida || undefined,
  };

  const alumnasQuery = useQuery({
    queryKey: queryKeys.alumnas.lista(filtros),
    queryFn: () => alumnasApi.listar(filtros),
  });

  const { alumnas, total } = useMemo(
    () => (alumnasQuery.data ? extraerAlumnas(alumnasQuery.data) : { alumnas: [], total: 0 }),
    [alumnasQuery.data]
  );

  /** Agrupar por grado da estructura cuando no hay filtro; con filtro solo estorbaría. */
  const porGrado = useMemo(() => {
    if (grado) return null;
    const mapa = new Map<string, Alumna[]>();
    for (const alumna of alumnas) {
      const grupo = mapa.get(alumna.grado);
      if (grupo) grupo.push(alumna);
      else mapa.set(alumna.grado, [alumna]);
    }
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [alumnas, grado]);

  const hayFiltro = Boolean(grado || busquedaDiferida);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Alumnas"
        description={
          alumnasQuery.isLoading
            ? 'Cargando el padrón…'
            : `${total} ${total === 1 ? 'alumna registrada' : 'alumnas registradas'}`
        }
        actions={
          <>
            {puede(rol, 'alumnas.verQR') && alumnas.length > 0 && (
              <Button
                variant="secondary"
                onClick={carnets.open}
                icon={<Printer className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Imprimir carnets
              </Button>
            )}
            {puede(rol, 'alumnas.crear') && (
              <Button
                variant="primary"
                onClick={nueva.open}
                icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Nueva alumna
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o DNI…"
          aria-label="Buscar alumnas"
          icon={<Search className="h-3.5 w-3.5" aria-hidden="true" />}
          className="h-9 flex-1"
        />
        <Select
          value={grado}
          onChange={(e) => setGrado(e.target.value)}
          aria-label="Filtrar por grado"
          className="h-9 sm:w-52"
        >
          <option value="">Todos los grados</option>
          {(gradosQuery.data ?? []).map((g) => (
            <option key={g.id} value={g.nombre}>
              {g.nombre}
            </option>
          ))}
        </Select>
      </div>

      {alumnasQuery.isError ? (
        <Card>
          <ErrorState
            title="No se pudo cargar el padrón"
            message={
              alumnasQuery.error instanceof Error ? alumnasQuery.error.message : undefined
            }
            onRetry={() => void alumnasQuery.refetch()}
          />
        </Card>
      ) : alumnasQuery.isLoading ? (
        <Card>
          <SkeletonRows rows={8} />
        </Card>
      ) : alumnas.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={hayFiltro ? 'Ninguna alumna coincide' : 'Todavía no hay alumnas'}
            description={
              hayFiltro
                ? 'Prueba con otro nombre o quita el filtro de grado.'
                : 'Registra la primera alumna para empezar a tomar asistencia.'
            }
            action={
              hayFiltro ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setBusqueda('');
                    setGrado('');
                  }}
                >
                  Quitar filtros
                </Button>
              ) : puede(rol, 'alumnas.crear') ? (
                <Button variant="primary" onClick={nueva.open}>
                  Registrar alumna
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : porGrado ? (
        <div className="flex flex-col gap-4">
          {porGrado.map(([nombreGrado, grupo]) => (
            <section key={nombreGrado} className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2 px-0.5">
                <h2 className="text-sm font-semibold text-content">{nombreGrado}</h2>
                <span className="text-xs text-content-muted tabular-nums">
                  {grupo.length} {grupo.length === 1 ? 'alumna' : 'alumnas'}
                </span>
              </div>
              <Card>
                <ul className="divide-y divide-border">
                  {grupo.map((alumna) => (
                    <FilaAlumna key={alumna.id} alumna={alumna} onVerQR={setQrAlumna} />
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {alumnas.map((alumna) => (
              <FilaAlumna key={alumna.id} alumna={alumna} onVerQR={setQrAlumna} />
            ))}
          </ul>
        </Card>
      )}

      <QRModal alumna={qrAlumna} onClose={() => setQrAlumna(null)} />
      <NuevaAlumnaModal open={nueva.isOpen} onClose={nueva.close} />
      <CarnetsModal alumnas={alumnas} open={carnets.isOpen} onClose={carnets.close} />
    </div>
  );
}
