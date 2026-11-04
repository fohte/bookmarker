import { describe, expect, it } from 'vitest'

import { verifyComment } from '#analysis/service'
import type { AnalysisConfig } from '#analysis/types'
import type { Article } from '#contracts/article'

const config: AnalysisConfig = {
  baseUrl: 'https://gateway.example.invalid/v1',
  apiKey: 'fictional-test-token',
  model: 'fixture-model',
}

const article: Article = {
  url: 'https://example.invalid/fictional-note',
  title: 'Fictional memo',
  text: 'The memo says “stored indoors for ５ days.\nthen checked.”',
  source: 'shared',
  partial: false,
}

const completionResponse = (content: string): Response =>
  new Response(
    [
      { choices: [{ index: 0, delta: { content } }] },
      { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
    ]
      .map((event) => `data: ${JSON.stringify(event)}\n\n`)
      .concat('data: [DONE]\n\n')
      .join(''),
    { headers: { 'content-type': 'text/event-stream' } },
  )

const verify = (articleValue: Article, comment: string, issues: unknown[]) =>
  verifyComment(
    articleValue,
    comment,
    config,
    () =>
      Promise.resolve(
        completionResponse(JSON.stringify({ status: 'ok', issues })),
      ),
    1000,
  ).match(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error }),
  )

describe('verifyComment', () => {
  it('matches citations after whitespace and Unicode normalization', async () => {
    const result = await verify(
      article,
      'A kit lasts ５ days.\nfor indoor storage.',
      [
        {
          kind: 'error',
          quote: '「A kit lasts 5 days. for indoor storage.」',
          reason: 'The duration conflicts with the memo.',
          evidence: '"stored indoors for 5 days. then checked."',
        },
      ],
    )

    expect(result).toEqual({
      ok: true,
      value: {
        issues: [
          {
            kind: 'error',
            quote: '「A kit lasts 5 days. for indoor storage.」',
            reason: 'The duration conflicts with the memo.',
            evidence: '"stored indoors for 5 days. then checked."',
          },
        ],
        partial: false,
      },
    })
  })

  it('drops issues with unmatched citations and keeps valid issues', async () => {
    const result = await verify(
      { ...article, partial: true },
      'The package lasts three weeks and is rechargeable.',
      [
        {
          kind: 'unsupported',
          quote: 'is rechargeable',
          reason: 'The memo does not mention a battery.',
        },
        {
          kind: 'error',
          quote: 'The package is made of glass',
          reason: 'The memo describes a different material.',
          evidence: 'The package is made of steel.',
        },
      ],
    )

    expect(result).toEqual({
      ok: true,
      value: {
        issues: [
          {
            kind: 'unsupported',
            quote: 'is rechargeable',
            reason: 'The memo does not mention a battery.',
          },
        ],
        partial: true,
        omittedIssueCount: 1,
      },
    })
  })
})
