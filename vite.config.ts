import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // GLTFLoader imports 'three' itself; make sure dev pre-bundling resolves both to one copy
  resolve: { dedupe: ['three'] },
  optimizeDeps: { include: ['three', 'three/examples/jsm/loaders/GLTFLoader.js', 'three/examples/jsm/utils/BufferGeometryUtils.js'] },
  test: { environment: 'node' },
} as any);
