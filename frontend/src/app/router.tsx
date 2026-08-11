import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useUsuario } from '@/features/auth/store';
import { rutaInicial } from '@/config/navigation';
import { Spinner } from '@/shared/ui';
import { Layout } from './Layout';
import { RequireAuth, RequireCapacidad } from './guards';
import { NotFoundPage } from './NotFoundPage';

/**
 * Cada pantalla es un fragmento independiente.
 *
 * El escáner arrastra `html5-qrcode` y los reportes `exceljs`; sin división
 * por ruta, el portero que solo escanea desde el móvil en la puerta
 * descargaba también el motor de hojas de cálculo. Ahora cada quien paga
 * solo por lo que abre.
 */
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const ScannerPage = lazy(() => import('@/features/asistencias/ScannerPage'));
const DashboardPage = lazy(() => import('@/features/asistencias/DashboardPage'));
const AlumnasPage = lazy(() => import('@/features/alumnas/AlumnasPage'));
const ReportesPage = lazy(() => import('@/features/reportes/ReportesPage'));

function CargandoPantalla() {
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner size="lg" label="Cargando la sección" />
    </div>
  );
}

function InicioSegunRol() {
  const usuario = useUsuario();
  return <Navigate to={rutaInicial(usuario?.rol)} replace />;
}

export function Router() {
  return (
    <BrowserRouter>
      <Suspense fallback={<CargandoPantalla />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<InicioSegunRol />} />

            <Route
              path="/scanner"
              element={
                <RequireCapacidad capacidad="asistencias.escanear">
                  <ScannerPage />
                </RequireCapacidad>
              }
            />
            <Route
              path="/dashboard"
              element={
                <RequireCapacidad capacidad="asistencias.ver">
                  <DashboardPage />
                </RequireCapacidad>
              }
            />
            <Route
              path="/alumnas"
              element={
                <RequireCapacidad capacidad="alumnas.ver">
                  <AlumnasPage />
                </RequireCapacidad>
              }
            />
            <Route
              path="/reportes"
              element={
                <RequireCapacidad capacidad="reportes.ver">
                  <ReportesPage />
                </RequireCapacidad>
              }
            />

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
