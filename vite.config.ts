import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps every asset URL relative, so the same build works at a
// domain root, under a GitHub Pages sub-path, or from any static file host.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      // ONNX Runtime's plain (non-bundled) WASM build: it loads its glue code and
      // .wasm from `wasmPaths` (public/ocr-runtime/ort/), so its WebAssembly
      // threads can start when the host enables cross-origin isolation.
      'onnxruntime-web/wasm': fileURLToPath(new URL('./node_modules/onnxruntime-web/dist/ort.wasm.min.mjs', import.meta.url)),
    },
  },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
