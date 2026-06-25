import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
  },
  {
    entry: ['src/utils/index.ts'],
    outDir: 'dist/utils',
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: false,
  },
  {
    entry: ['src/mock/index.ts'],
    outDir: 'dist/mock',
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: false,
  },
  {
    entry: ['src/map/index.ts'],
    outDir: 'dist/map',
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: false,
  },
])
