import { build } from 'esbuild'

await build({
  entryPoints: ['electron/preload.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist-electron/preload.js',
  external: ['electron'],
})

console.log('✓ Preload built as CommonJS')
