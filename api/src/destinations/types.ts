import type {
  DeliveryResult,
  DestinationMetadata,
  PublishArticle,
  PublishDestinationId,
  PublishTarget,
} from 'api/contracts'
import type { ResultAsync } from 'neverthrow'

type PublishAdapterErrorCode =
  | 'not_configured'
  | 'rejected'
  | 'unauthorized'
  | 'rate_limited'
  | 'unavailable'
  | 'invalid_response'

export type PublishAdapterError = {
  code: PublishAdapterErrorCode
  outcome: 'failed' | 'unknown'
  retryable: boolean
}

export type MetadataAdapterError = {
  code: 'unavailable' | 'unauthorized' | 'rate_limited' | 'invalid_response'
}

export type DestinationAdapter<D extends PublishDestinationId> = {
  destination: D
  configured: boolean
  getMetadata: () => ResultAsync<
    DestinationMetadata['destinations'][D],
    MetadataAdapterError
  >
  publish: (input: {
    article: PublishArticle
    target: Extract<PublishTarget, { destination: D }>
  }) => ResultAsync<DeliveryResult, PublishAdapterError>
}

export type DestinationRegistry = {
  hatena: DestinationAdapter<'hatena'>
  mastodon: DestinationAdapter<'mastodon'>
  raindrop: DestinationAdapter<'raindrop'>
}
