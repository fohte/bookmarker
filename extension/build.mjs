import { copyFile } from 'node:fs/promises'

import * as esbuild from 'esbuild'

import { parseBookmarkerOrigin } from '#origin'

const origin = parseBookmarkerOrigin(process.env.BOOKMARKER_ORIGIN ?? '')
if (origin === undefined) {
  console.error(
    'BOOKMARKER_ORIGIN must be an https:// URL, or an http://localhost URL for local development.',
  )
  process.exit(1)
}

await esbuild.build({
  entryPoints: ['src/background.ts'],
  bundle: true,
  format: 'iife',
  outdir: 'dist',
  define: { 'process.env.BOOKMARKER_ORIGIN': JSON.stringify(origin) },
})

await copyFile('manifest.json', 'dist/manifest.json')
