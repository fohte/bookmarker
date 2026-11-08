import { execFile } from 'node:child_process'
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { runInNewContext } from 'node:vm'

import { expect, it, onTestFinished, vi } from 'vitest'

const packagePath = (file: string) =>
  fileURLToPath(new URL(file, import.meta.url))

it('embeds the deployment origin in the popup and its permissions', async () => {
  // The build writes to its working directory; a temporary one keeps a real extension/dist intact.
  const workDir = await mkdtemp(join(tmpdir(), 'extension-build-'))
  onTestFinished(() => rm(workDir, { recursive: true }))
  await cp(packagePath('src/popup.ts'), join(workDir, 'src/popup.ts'))
  await cp(packagePath('manifest.json'), join(workDir, 'manifest.json'))
  await cp(packagePath('popup.html'), join(workDir, 'popup.html'))

  await promisify(execFile)(process.execPath, [packagePath('build.mjs')], {
    cwd: workDir,
    env: {
      ...process.env,
      BOOKMARKER_ORIGIN: 'https://other-app.example.invalid',
    },
  })

  const editor = { src: '', hidden: true }
  // The context has no `process`, as in an extension page, so a missing substitution fails on open.
  runInNewContext(await readFile(join(workDir, 'dist/popup.js'), 'utf8'), {
    URL,
    chrome: {
      tabs: {
        query: () => Promise.resolve([{ url: 'https://example.com/story' }]),
      },
    },
    document: { querySelector: () => editor },
    fetch: () => Promise.resolve({ type: 'basic' }),
  })
  await vi.waitFor(() => {
    expect(editor).toEqual({
      src: 'https://other-app.example.invalid/compose?url=https%3A%2F%2Fexample.com%2Fstory',
      hidden: false,
    })
  })

  expect(await readFile(join(workDir, 'dist/popup.html'), 'utf8')).toBe(
    await readFile(packagePath('popup.html'), 'utf8'),
  )

  const manifest: unknown = JSON.parse(
    await readFile(join(workDir, 'dist/manifest.json'), 'utf8'),
  )
  expect(manifest).toEqual({
    manifest_version: 3,
    name: 'Bookmarker',
    version: '0.1.0',
    description:
      'Open the article in the current tab in the Bookmarker editor.',
    action: {
      default_title: 'Open in Bookmarker',
      default_popup: 'popup.html',
    },
    permissions: ['activeTab'],
    host_permissions: ['https://other-app.example.invalid/*'],
  })
})
