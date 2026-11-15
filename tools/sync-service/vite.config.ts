import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: process.env.APPDEPLOY_VITE_OUT_DIR || 'dist',
    sourcemap:
      process.env.APPDEPLOY_VITE_SOURCEMAP === 'hidden' ? 'hidden' : false,
    target: ['chrome87', 'edge88', 'firefox78', 'safari14'],
  },
});
