import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { Providers } from '@/app/providers';
import { Router } from '@/app/router';
import './index.css';

// El límite de error envuelve a los proveedores: si el propio QueryClient o
// el proveedor de notificaciones fallan al montar, sigue habiendo una
// pantalla que lo explique en lugar de un blanco.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Providers>
        <Router />
      </Providers>
    </ErrorBoundary>
  </React.StrictMode>
);
