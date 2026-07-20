import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import ScannerPage from './pages/ScannerPage';
import DashboardPage from './pages/DashboardPage';
import AlumnasPage from './pages/AlumnasPage';
import ReportesPage from './pages/ReportesPage';
import Layout from './components/Layout';
import type { Rol } from './types';

function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: Rol[] }) {
  const { isAuthenticated, usuario } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && usuario && !roles.includes(usuario.rol as Rol)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function HomeRedirect() {
  const { usuario } = useAuth();
  if (usuario?.rol === 'portero') return <Navigate to="/scanner" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<HomeRedirect />} />

          <Route
            path="/scanner"
            element={
              <RequireAuth roles={['portero', 'admin', 'auxiliar']}>
                <ScannerPage />
              </RequireAuth>
            }
          />

          <Route
            path="/dashboard"
            element={
              <RequireAuth roles={['auxiliar', 'tutora', 'directora', 'admin']}>
                <DashboardPage />
              </RequireAuth>
            }
          />

          <Route
            path="/alumnas"
            element={
              <RequireAuth roles={['admin', 'auxiliar', 'directora']}>
                <AlumnasPage />
              </RequireAuth>
            }
          />

          <Route
            path="/reportes"
            element={
              <RequireAuth roles={['auxiliar', 'tutora', 'directora', 'admin']}>
                <ReportesPage />
              </RequireAuth>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
