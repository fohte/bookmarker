import { describe, expect, it } from 'vitest'

import { promptHidden } from '#destinations/hatena/terminal'

describe('promptHidden', () => {
  it('reads a secret without writing entered characters to output', async () => {
    type FakeInput = NonNullable<Parameters<typeof promptHidden>[1]>
    const modes: boolean[] = []
    const output: string[] = []
    let listener: ((chunk: Buffer | string) => void) | undefined
    const input: FakeInput = {
      isTTY: true,
      setRawMode: (enabled) => modes.push(enabled),
      resume: () => undefined,
      pause: () => undefined,
      on: (_event, callback) => {
        listener = callback
      },
      off: (_event, callback) => {
        if (listener === callback) listener = undefined
      },
    }
    const pendingResult = promptHidden('Consumer secret: ', input, {
      write: (text) => output.push(text),
    }).match(
      (value) => ({ kind: 'success' as const, value }),
      (error) => ({ kind: 'error' as const, error }),
    )
    listener?.(Buffer.from('fictional-hidden-secret\n'))

    const summarizePrompt = async () => ({
      result: await pendingResult,
      modes,
      output,
    })
    expect(await summarizePrompt()).toEqual({
      result: { kind: 'success', value: 'fictional-hidden-secret' },
      modes: [true, false],
      output: ['Consumer secret: ', '\n'],
    })
  })
})
