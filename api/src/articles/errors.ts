export const ARTICLE_INVALID_INPUT = { kind: 'invalid-input' } as const
export const ARTICLE_UNSAFE_URL = { kind: 'unsafe-url' } as const
export const ARTICLE_FETCH_FAILED = { kind: 'fetch-failed' } as const
export const ARTICLE_FETCH_TIMEOUT = { kind: 'timeout' } as const

export type ArticleExtractionError =
  | typeof ARTICLE_INVALID_INPUT
  | typeof ARTICLE_UNSAFE_URL
  | typeof ARTICLE_FETCH_FAILED
  | typeof ARTICLE_FETCH_TIMEOUT
