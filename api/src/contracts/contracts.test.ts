import {
  ApiErrorEnvelopeSchema,
  ArticleSchema,
  BookmarkDraftSchema,
  DeliveryResultSchema,
  DestinationDraftSchema,
  PublishRequestSchema,
  ShareInputSchema,
  SummarySchema,
  VerificationSchema,
} from 'api/contracts'
import { describe, expect, it } from 'vitest'

const summarizeParse = <T>(
  result:
    | { success: true; data: T }
    | { success: false; error: { issues: unknown[] } },
) => {
  if (!result.success) {
    return { success: false, issues: result.error.issues }
  }

  return { success: true, data: result.data }
}

const summarizeShareTextParse = (
  result: ReturnType<typeof ShareInputSchema.safeParse>,
) => {
  if (!result.success) {
    return { success: false, issues: result.error.issues }
  }

  const { sharedText, ...data } = result.data
  return {
    success: true,
    data: { ...data, sharedTextCodeUnits: sharedText?.length },
  }
}

describe('ShareInput', () => {
  it('defaults partial to false', () => {
    expect(
      ShareInputSchema.safeParse({
        version: 1,
        url: 'https://example.com/story',
      }),
    ).toEqual({
      success: true,
      data: {
        version: 1,
        url: 'https://example.com/story',
        partial: false,
      },
    })
  })

  it('rejects non-HTTP URLs', () => {
    expect(
      summarizeParse(
        ShareInputSchema.safeParse({
          version: 1,
          url: 'javascript:alert(1)',
        }),
      ),
    ).toEqual({
      success: false,
      issues: [
        {
          code: 'invalid_format',
          format: 'url',
          message: 'Invalid URL',
          note: 'Invalid URL format',
          path: ['url'],
        },
      ],
    })
  })

  it('accepts 100000 UTF-16 code units of sharedText', () => {
    expect(
      summarizeShareTextParse(
        ShareInputSchema.safeParse({
          version: 1,
          url: 'https://example.com/story',
          sharedText: '😀'.repeat(50_000),
        }),
      ),
    ).toEqual({
      success: true,
      data: {
        version: 1,
        url: 'https://example.com/story',
        partial: false,
        sharedTextCodeUnits: 100_000,
      },
    })
  })

  it('rejects sharedText over 100000 UTF-16 code units', () => {
    expect(
      summarizeParse(
        ShareInputSchema.safeParse({
          version: 1,
          url: 'https://example.com/story',
          sharedText: '😀'.repeat(50_001),
        }),
      ),
    ).toEqual({
      success: false,
      issues: [
        {
          code: 'custom',
          message: 'Text must be at most 100000 UTF-16 code units.',
          path: ['sharedText'],
        },
      ],
    })
  })
})

describe('Article, Summary, and Verification', () => {
  it('validates an article DTO', () => {
    expect(
      ArticleSchema.safeParse({
        url: 'https://example.com/story',
        title: 'Sample article',
        text: 'Sample article text',
        source: 'shared',
        partial: false,
      }),
    ).toEqual({
      success: true,
      data: {
        url: 'https://example.com/story',
        title: 'Sample article',
        text: 'Sample article text',
        source: 'shared',
        partial: false,
      },
    })
  })

  it('validates a summary DTO', () => {
    expect(
      SummarySchema.safeParse({ summary: 'Sample summary', partial: false }),
    ).toEqual({
      success: true,
      data: { summary: 'Sample summary', partial: false },
    })
  })

  it('validates a verification DTO', () => {
    expect(
      VerificationSchema.safeParse({
        issues: [
          {
            kind: 'uncertain',
            quote: 'Sample claim',
            reason: 'The article does not provide enough evidence.',
          },
        ],
        partial: false,
      }),
    ).toEqual({
      success: true,
      data: {
        issues: [
          {
            kind: 'uncertain',
            quote: 'Sample claim',
            reason: 'The article does not provide enough evidence.',
          },
        ],
        partial: false,
      },
    })
  })
})

describe('DestinationDraft', () => {
  it('allows an empty custom comment and defaults it to empty', () => {
    expect(
      DestinationDraftSchema.parse({
        destination: 'mastodon',
        selected: true,
        commentMode: 'custom',
        options: {
          visibility: 'unlisted',
          spoilerText: '',
          sensitive: false,
        },
      }),
    ).toEqual({
      destination: 'mastodon',
      selected: true,
      commentMode: 'custom',
      customComment: '',
      options: {
        visibility: 'unlisted',
        spoilerText: '',
        sensitive: false,
      },
    })
  })
})

describe('PublishRequest', () => {
  it('accepts a publish target without X', () => {
    expect(
      PublishRequestSchema.safeParse({
        article: { url: 'https://example.com/story' },
        targets: [
          {
            destination: 'hatena',
            operationId: 'a813a5ad-d795-42fb-a2a0-c08b305d7684',
            comment: 'Sample comment',
            options: { tags: [], private: false },
          },
        ],
      }),
    ).toEqual({
      success: true,
      data: {
        article: { url: 'https://example.com/story' },
        targets: [
          {
            destination: 'hatena',
            operationId: 'a813a5ad-d795-42fb-a2a0-c08b305d7684',
            comment: 'Sample comment',
            options: { tags: [], private: false },
          },
        ],
      },
    })
  })

  it('rejects duplicate target destinations', () => {
    const target = {
      destination: 'hatena',
      operationId: 'a813a5ad-d795-42fb-a2a0-c08b305d7684',
      comment: 'Sample comment',
      options: { tags: [], private: false },
    }

    expect(
      summarizeParse(
        PublishRequestSchema.safeParse({
          article: { url: 'https://example.com/story' },
          targets: [
            target,
            {
              ...target,
              operationId: 'b6119850-c199-48f0-b62c-2859275623b2',
            },
          ],
        }),
      ),
    ).toEqual({
      success: false,
      issues: [
        {
          code: 'custom',
          message: 'Each destination can only appear once.',
          path: ['targets', 1, 'destination'],
        },
      ],
    })
  })

  it('rejects an empty target list', () => {
    expect(
      summarizeParse(
        PublishRequestSchema.safeParse({
          article: { url: 'https://example.com/story' },
          targets: [],
        }),
      ),
    ).toEqual({
      success: false,
      issues: [
        {
          code: 'too_small',
          inclusive: true,
          message: 'Too small: expected array to have >=1 items',
          minimum: 1,
          origin: 'array',
          path: ['targets'],
        },
      ],
    })
  })

  it('rejects X as an API publish target', () => {
    expect(
      summarizeParse(
        PublishRequestSchema.safeParse({
          article: { url: 'https://example.com/story' },
          targets: [
            {
              destination: 'x',
              operationId: '20bdd113-0d90-470a-9372-6fb23bc91e14',
              comment: 'Sample comment',
              options: {},
            },
          ],
        }),
      ),
    ).toEqual({
      success: false,
      issues: [
        {
          code: 'invalid_union',
          discriminator: 'destination',
          errors: [],
          message:
            "Invalid discriminator value. Expected 'hatena' | 'mastodon' | 'raindrop'",
          note: 'No matching discriminator',
          options: ['hatena', 'mastodon', 'raindrop'],
          path: ['targets', 0, 'destination'],
        },
      ],
    })
  })
})

describe('DeliveryResult', () => {
  const base = {
    destination: 'raindrop',
    operationId: 'd3abc350-c760-4eec-9ddb-fb21477df4db',
  }

  it('rejects retryable succeeded results', () => {
    expect(
      summarizeParse(
        DeliveryResultSchema.safeParse({
          ...base,
          status: 'succeeded',
          retryable: true,
        }),
      ),
    ).toEqual({
      success: false,
      issues: [
        {
          code: 'invalid_value',
          message: 'Invalid input: expected false',
          path: ['retryable'],
          values: [false],
        },
      ],
    })
  })

  it('rejects retryable unknown results', () => {
    expect(
      summarizeParse(
        DeliveryResultSchema.safeParse({
          ...base,
          status: 'unknown',
          retryable: true,
        }),
      ),
    ).toEqual({
      success: false,
      issues: [
        {
          code: 'invalid_value',
          message: 'Invalid input: expected false',
          path: ['retryable'],
          values: [false],
        },
      ],
    })
  })

  it('allows a failed result to be retryable', () => {
    expect(
      DeliveryResultSchema.safeParse({
        ...base,
        status: 'failed',
        retryable: true,
      }),
    ).toEqual({
      success: true,
      data: {
        ...base,
        status: 'failed',
        retryable: true,
      },
    })
  })
})

describe('BookmarkDraft and API errors', () => {
  it('defaults the stored draft collections and source partial flag', () => {
    expect(
      BookmarkDraftSchema.safeParse({
        version: 1,
        id: '9fcb8334-cd5c-4375-8a41-caecc57def69',
        source: { version: 1, url: 'https://example.com/story' },
        commonComment: '',
        updatedAt: '2000-01-01T00:00:00.000Z',
      }),
    ).toEqual({
      success: true,
      data: {
        version: 1,
        id: '9fcb8334-cd5c-4375-8a41-caecc57def69',
        source: {
          version: 1,
          url: 'https://example.com/story',
          partial: false,
        },
        commonComment: '',
        destinations: [],
        delivery: [],
        updatedAt: '2000-01-01T00:00:00.000Z',
      },
    })
  })

  it('rejects duplicate stored destination drafts', () => {
    const destination = {
      destination: 'x',
      selected: true,
      commentMode: 'custom',
      customComment: '',
    }

    expect(
      summarizeParse(
        BookmarkDraftSchema.safeParse({
          version: 1,
          id: '9fcb8334-cd5c-4375-8a41-caecc57def69',
          source: { version: 1, url: 'https://example.com/story' },
          commonComment: '',
          destinations: [destination, destination],
          updatedAt: '2000-01-01T00:00:00.000Z',
        }),
      ),
    ).toEqual({
      success: false,
      issues: [
        {
          code: 'custom',
          message: 'Each destination can only appear once.',
          path: ['destinations', 1, 'destination'],
        },
      ],
    })
  })

  it('preserves the sent article in a pending delivery snapshot', () => {
    expect(
      BookmarkDraftSchema.safeParse({
        version: 1,
        id: '9fcb8334-cd5c-4375-8a41-caecc57def69',
        source: { version: 1, url: 'https://example.com/story' },
        article: {
          url: 'https://example.com/current',
          title: 'Current article',
          text: 'Current article text',
          source: 'manual',
          partial: false,
        },
        commonComment: '',
        delivery: [
          {
            article: {
              url: 'https://example.com/sent',
              title: 'Sent article',
            },
            target: {
              destination: 'hatena',
              operationId: 'a813a5ad-d795-42fb-a2a0-c08b305d7684',
              comment: 'Sent comment',
              options: { tags: ['sample'], private: false },
            },
          },
        ],
        updatedAt: '2000-01-01T00:00:00.000Z',
      }),
    ).toEqual({
      success: true,
      data: {
        version: 1,
        id: '9fcb8334-cd5c-4375-8a41-caecc57def69',
        source: {
          version: 1,
          url: 'https://example.com/story',
          partial: false,
        },
        article: {
          url: 'https://example.com/current',
          title: 'Current article',
          text: 'Current article text',
          source: 'manual',
          partial: false,
        },
        commonComment: '',
        destinations: [],
        delivery: [
          {
            article: {
              url: 'https://example.com/sent',
              title: 'Sent article',
            },
            target: {
              destination: 'hatena',
              operationId: 'a813a5ad-d795-42fb-a2a0-c08b305d7684',
              comment: 'Sent comment',
              options: { tags: ['sample'], private: false },
            },
          },
        ],
        updatedAt: '2000-01-01T00:00:00.000Z',
      },
    })
  })

  it('rejects a delivery snapshot without its sent article', () => {
    expect(
      summarizeParse(
        BookmarkDraftSchema.safeParse({
          version: 1,
          id: '9fcb8334-cd5c-4375-8a41-caecc57def69',
          source: { version: 1, url: 'https://example.com/story' },
          commonComment: '',
          delivery: [
            {
              target: {
                destination: 'hatena',
                operationId: 'a813a5ad-d795-42fb-a2a0-c08b305d7684',
                comment: 'Sent comment',
                options: { tags: ['sample'], private: false },
              },
            },
          ],
          updatedAt: '2000-01-01T00:00:00.000Z',
        }),
      ),
    ).toEqual({
      success: false,
      issues: [
        {
          code: 'invalid_type',
          expected: 'object',
          message: 'Invalid input: expected object, received undefined',
          path: ['delivery', 0, 'article'],
        },
      ],
    })
  })

  it('validates the shared API error envelope', () => {
    expect(
      ApiErrorEnvelopeSchema.safeParse({
        error: { code: 'invalid_request', message: 'Request is invalid.' },
      }),
    ).toEqual({
      success: true,
      data: {
        error: { code: 'invalid_request', message: 'Request is invalid.' },
      },
    })
  })

  it('rejects an API error without an error object', () => {
    expect(
      summarizeParse(
        ApiErrorEnvelopeSchema.safeParse({ error: 'Request is invalid.' }),
      ),
    ).toEqual({
      success: false,
      issues: [
        {
          code: 'invalid_type',
          expected: 'object',
          message: 'Invalid input: expected object, received string',
          path: ['error'],
        },
      ],
    })
  })
})
