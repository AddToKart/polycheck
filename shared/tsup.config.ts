import { defineConfig } from 'tsup'

// One config instead of parallel entry configs: multiple configs run
// concurrently and the first config's `clean` can delete sibling declaration
// files that were just emitted (e.g. dist/map/index.d.ts).
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'utils/index': 'src/utils/index.ts',
    'map/index': 'src/map/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
})
