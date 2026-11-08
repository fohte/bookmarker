import { execFile } from 'node:child_process'
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { runInNewContext } from 'node:vm'

import { expect, it, onTestFinished, vi } from 'vitest'

type ClickedTab = { url: string; index: number }

const packagePath = (file: string) =>
  fileURLToPath(new URL(file, import.meta.url))

it('embeds the deployment origin in the service worker', async () => {
  // The build writes to its working directory; a temporary one keeps a real extension/dist intact.
  const workDir = await mkdtemp(join(tmpdir(), 'extension-build-'))
  onTestFinished(() => rm(workDir, { recursive: true }))
  await cp(packagePath('src/background.ts'), join(workDir, 'src/background.ts'))
  await cp(packagePath('manifest.json'), join(workDir, 'manifest.json'))

  await promisify(execFile)(process.execPath, [packagePath('build.mjs')], {
    cwd: workDir,
    env: {
      ...process.env,
      BOOKMARKER_ORIGIN: 'https://other-app.example.invalid',
    },
  })

  let clicked: ((tab: ClickedTab) => void) | undefined
  const createTab = vi.fn()
  // The context has no `process`, as in a service worker, so a missing substitution fails on click.
  runInNewContext(await readFile(join(workDir, 'dist/background.js'), 'utf8'), {
    URL,
    chrome: {
      action: {
        onClicked: {
          addListener: (listener: (tab: ClickedTab) => void) => {
            clicked = listener
          },
        },
      },
      tabs: { create: createTab },
    },
  })
  clicked?.({ url: 'https://example.com/story', index: 2 })

  expect(createTab.mock.calls).toEqual([
    [
      {
        url: 'https://other-app.example.invalid/compose?url=https%3A%2F%2Fexample.com%2Fstory',
        index: 3,
      },
    ],
  ])
})
