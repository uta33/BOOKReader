import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const API_PORT = process.env.API_PORT ?? '8787';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32-reading-note.png', 'apple-touch-icon-reading-note.png'],
      manifest: {
        name: 'READING NOTE',
        short_name: 'READING NOTE',
        description: 'AI要約を聴いて、自分の言葉でふりかえり、間隔反復で身につける読書アプリ',
        lang: 'ja',
        theme_color: '#F3F1E8',
        background_color: '#F3F1E8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-reading-note-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-reading-note-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-reading-note-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': `http://localhost:${API_PORT}`,
    },
  },
});
