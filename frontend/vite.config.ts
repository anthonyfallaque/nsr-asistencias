import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  build: {
    // Separar las dependencias pesadas del arranque. ExcelJS y html5-qrcode
    // solo se cargan cuando la ruta que los usa se abre de verdad, así el
    // portero que únicamente escanea no descarga el motor de hojas de cálculo.
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },

  plugins: [
    react(),
    nodePolyfills({ protocolImports: true }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Asistencias NSR',
        short_name: 'Asistencias',
        description: 'Sistema de asistencias - Nuestra Señora del Rosario',
        theme_color: '#1e3a8a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // ExcelJS pesa ~940 KB y solo lo usa quien exporta un reporte.
        // Precachearlo obligaba a todos los dispositivos —incluido el móvil
        // del portero, con datos móviles— a descargarlo en segundo plano.
        // Queda fuera del precache y se guarda en caché la primera vez que
        // se usa de verdad.
        globIgnores: ['**/exceljs*.js'],
        runtimeCaching: [
          {
            urlPattern: /exceljs.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'vendor-pesado',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https?:\/\/.*\/api\/(alumnas|asistencias\/resumen)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxAgeSeconds: 60 * 5 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
