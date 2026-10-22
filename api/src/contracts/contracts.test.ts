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
      ShareInputSchema.safeParse({
        version: 1,
        url: 'javascript:alert(1)',
      }).success,
    ).toEqual(false)
  })

  it('accepts 100000 UTF-16 code units of sharedText', () => {
    expect(
      ShareInputSchema.safeParse({
        version: 1,
        url: 'https://example.com/story',
        sharedText: '😀'.repeat(50_000),
      }).success,
    ).toEqual(true)
  })

  it('rejects sharedText over 100000 UTF-16 code units', () => {
    expect(
      ShareInputSchema.safeParse({
        version: 1,
        url: 'https://example.com/story',
        sharedText: '😀'.repeat(50_001),
      }).success,
    ).toEqual(false)
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
      }).success,
    ).toEqual(true)
  })

  it('validates a summary DTO', () => {
    expect(
      SummarySchema.safeParse({ summary: 'Sample summary', partial: false })
        .success,
    ).toEqual(true)
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
      }).success,
    ).toEqual(true)
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
      }).success,
    ).toEqual(true)
  })

  it('rejects duplicate target destinations', () => {
    const target = {
      destination: 'hatena',
      operationId: 'a813a5ad-d795-42fb-a2a0-c08b305d7684',
      comment: 'Sample comment',
      options: { tags: [], private: false },
    }

    expect(
      PublishRequestSchema.safeParse({
        article: { url: 'https://example.com/story' },
        targets: [
          target,
          {
            ...target,
            operationId: 'b6119850-c199-48f0-b62c-2859275623b2',
          },
        ],
      }).success,
    ).toEqual(false)
  })

  it('rejects X as an API publish target', () => {
    expect(
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
      }).success,
    ).toEqual(false)
  })
})

describe('DeliveryResult', () => {
  const base = {
    destination: 'raindrop',
    operationId: 'd3abc350-c760-4eec-9ddb-fb21477df4db',
  }

  it('rejects retryable succeeded results', () => {
    expect(
      DeliveryResultSchema.safeParse({
        ...base,
        status: 'succeeded',
        retryable: true,
      }).success,
    ).toEqual(false)
  })

  it('rejects retryable unknown results', () => {
    expect(
      DeliveryResultSchema.safeParse({
        ...base,
        status: 'unknown',
        retryable: true,
      }).success,
    ).toEqual(false)
  })

  it('allows a failed result to be retryable', () => {
    expect(
      DeliveryResultSchema.safeParse({
        ...base,
        status: 'failed',
        retryable: true,
      }).success,
    ).toEqual(true)
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
      ApiErrorEnvelopeSchema.safeParse({ error: 'Request is invalid.' })
        .success,
    ).toEqual(false)
  })
})
