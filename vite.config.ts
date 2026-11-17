import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>({
  plugins:[react()],
  // GitHub Pages hosts this repository under /zhengyuan/.
  // The normal Node server continues to use /.
  base:mode==='pages'?'/zhengyuan/':'/',
  define:{'import.meta.env.VITE_STATIC_DEMO':JSON.stringify(mode==='pages'?'true':'false')},
  server:{host:'127.0.0.1'},
  build:{outDir:mode==='pages'?'dist-pages':'dist',chunkSizeWarningLimit:600},
}));
