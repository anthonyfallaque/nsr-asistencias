import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { alumnas as alumnasApi } from '../services/api';
import type { Alumna } from '../types';

export default function AlumnasPage() {
  const [buscar, setBuscar] = useState('');
  const [gradoFiltro, setGradoFiltro] = useState('');
  const [qrModal, setQrModal] = useState<Alumna | null>(null);
  const [qrData, setQrData] = useState<{
    qr_image: string; nombre_completo: string; grado: string; seccion: string;
  } | null>(null);

  const { data: grados = [] } = useQuery({
    queryKey: ['grados'],
    queryFn: alumnasApi.grados,
  });

  const { data: lista = [], isLoading } = useQuery({
    queryKey: ['alumnas', gradoFiltro, buscar],
    queryFn: () => alumnasApi.listar({ grado: gradoFiltro || undefined, buscar: buscar || undefined }),
    staleTime: 30_000,
  });

  async function verQR(alumna: Alumna) {
    setQrModal(alumna);
    setQrData(null);
    try {
      const data = await alumnasApi.qr(alumna.id);
      setQrData(data);
    } catch { /* noop */ }
  }

  function descargarQR() {
    if (!qrData || !qrModal) return;
    const a = document.createElement('a');
    a.href = qrData.qr_image;
    a.download = `QR_${qrModal.apellidos}_${qrModal.nombres}.png`.replace(/\s+/g, '_');
    a.click();
  }

  const gradosOrden = [...new Set((lista as Alumna[]).map(a => a.grado))].sort();

  return (
    <div className="space-y-4">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-nsr-navy">Alumnas</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full font-medium">
          {(lista as Alumna[]).length} registros
        </span>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute w-4 h-4 text-gray-400 -translate-y-1/2 left-3 top-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Buscar por nombre o DNI..."
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            className="pl-10 input"
          />
        </div>
        <select
          value={gradoFiltro}
          onChange={e => setGradoFiltro(e.target.value)}
          className="flex-shrink-0 w-auto input"
        >
          <option value="">Todos</option>
          {grados.map(g => <option key={g.id} value={g.nombre}>{g.nombre}</option>)}
        </select>
      </div>

      {/* Lista agrupada por grado */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Cargando alumnas...
        </div>
      ) : (lista as Alumna[]).length === 0 ? (
        <div className="py-16 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 110 8 4 4 0 010-8z" />
          </svg>
          <p className="text-gray-400">No se encontraron alumnas</p>
        </div>
      ) : gradoFiltro ? (
        <AlumnaTable alumnas={lista as Alumna[]} onQR={verQR} />
      ) : (
        <div className="space-y-4">
          {gradosOrden.map(grado => {
            const grupo = (lista as Alumna[]).filter(a => a.grado === grado);
            return (
              <div key={grado}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold tracking-wider uppercase text-nsr-wine">{grado} Secundaria</span>
                  <span className="text-xs text-gray-300">({grupo.length} alumnas)</span>
                </div>
                <AlumnaTable alumnas={grupo} onQR={verQR} />
              </div>
            );
          })}
        </div>
      )}

      {/* Modal QR */}
      {qrModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 bg-black/60 sm:items-center sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) { setQrModal(null); setQrData(null); } }}
        >
          <div className="w-full max-w-xs bg-white shadow-2xl rounded-t-3xl sm:rounded-3xl">
            {/* Handle móvil */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="p-6 text-center">
              {/* Info alumna */}
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 rounded-full bg-nsr-navy">
                <span className="font-bold text-white">{qrModal.apellidos.charAt(0)}</span>
              </div>
              <h3 className="text-base font-bold leading-tight text-nsr-navy">
                {qrModal.apellidos}, {qrModal.nombres}
              </h3>
              {qrData && (
                <p className="mt-1 text-sm text-gray-400">{qrData.grado} &quot;{qrData.seccion}&quot;</p>
              )}

              {/* QR */}
              <div className="flex justify-center my-5">
                {!qrData ? (
                  <div className="flex items-center justify-center w-48 h-48 border-2 border-gray-200 border-dashed bg-gray-50 rounded-2xl">
                    <svg className="w-8 h-8 text-gray-300 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  </div>
                ) : (
                  <img
                    src={qrData.qr_image}
                    alt="QR"
                    className="w-48 h-48 border-4 shadow-lg rounded-2xl border-nsr-navy"
                  />
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setQrModal(null); setQrData(null); }}
                  className="btn-secondary flex-1 py-2.5"
                >
                  Cerrar
                </button>
                {qrData && (
                  <button onClick={descargarQR} className="btn-primary flex-1 py-2.5">
                    Descargar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AlumnaTable({ alumnas, onQR }: { alumnas: Alumna[]; onQR: (a: Alumna) => void }) {
  return (
    <div className="p-0 overflow-hidden card">
      <div className="divide-y divide-gray-50">
        {alumnas.map(a => (
          <div key={a.id} className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50 active:bg-gray-100">
            <div className="flex items-center min-w-0 gap-3">
              <div className="flex items-center justify-center flex-shrink-0 w-9 h-9 rounded-xl bg-nsr-navy/10">
                <span className="text-sm font-bold text-nsr-navy">{a.apellidos.charAt(0)}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight text-gray-900 truncate">
                  {a.apellidos}, {a.nombres}
                </p>
                <p className="text-xs text-gray-400">
                  {a.grado} &quot;{a.seccion}&quot;{a.dni ? ` · ${a.dni}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={() => onQR(a)}
              className="flex-shrink-0 ml-3 flex items-center gap-1.5 text-nsr-navy text-xs font-semibold bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              QR
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
