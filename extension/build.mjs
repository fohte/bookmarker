import { copyFile, readFile, writeFile } from 'node:fs/promises'

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
  entryPoints: ['src/popup.ts'],
  bundle: true,
  format: 'iife',
  outdir: 'dist',
  define: { 'process.env.BOOKMARKER_ORIGIN': JSON.stringify(origin) },
})

const manifest = JSON.parse(await readFile('manifest.json', 'utf8'))
// Without this, Chrome treats the embedded editor as third-party: its sign-in cookie is withheld and its drafts are partitioned.
manifest.host_permissions = [`${origin}/*`]
await writeFile('dist/manifest.json', JSON.stringify(manifest, null, 2))

await copyFile('popup.html', 'dist/popup.html')
