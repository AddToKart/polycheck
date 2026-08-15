import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const packageRoot = join(frontendRoot, 'node_modules', 'maplibre-gl')
const targetRoot = join(frontendRoot, 'public', 'vendor', 'maplibre')

await mkdir(targetRoot, { recursive: true })
await Promise.all([
  copyFile(join(packageRoot, 'dist', 'maplibre-gl-worker.mjs'), join(targetRoot, 'maplibre-gl-worker.mjs')),
  copyFile(join(packageRoot, 'dist', 'maplibre-gl-shared.mjs'), join(targetRoot, 'maplibre-gl-shared.mjs')),
  copyFile(join(packageRoot, 'LICENSE.txt'), join(targetRoot, 'LICENSE.txt')),
])
