import { z } from 'zod'

import {
  HatenaOptionsSchema,
  MastodonOptionsSchema,
  RaindropOptionsSchema,
} from '#contracts/destination'
import { HttpUrlSchema } from '#contracts/http'
import { findDuplicateDestinationIndexes } from '#contracts/unique-destinations'

export const PublishTargetSchema = z.discriminatedUnion('destination', [
  z
    .object({
      destination: z.literal('hatena'),
      operationId: z.uuid(),
      comment: z.string(),
      options: HatenaOptionsSchema,
    })
    .strict(),
  z
    .object({
      destination: z.literal('mastodon'),
      operationId: z.uuid(),
      comment: z.string(),
      options: MastodonOptionsSchema,
    })
    .strict(),
  z
    .object({
      destination: z.literal('raindrop'),
      operationId: z.uuid(),
      comment: z.string(),
      options: RaindropOptionsSchema,
    })
    .strict(),
])

export type PublishTarget = z.infer<typeof PublishTargetSchema>

export const PublishArticleSchema = z
  .object({ url: HttpUrlSchema, title: z.string().optional() })
  .strict()

export type PublishArticle = z.infer<typeof PublishArticleSchema>

export const PublishRequestSchema = z
  .object({
    article: PublishArticleSchema,
    targets: z.array(PublishTargetSchema).min(1),
  })
  .strict()
  .superRefine(({ targets }, context) => {
    for (const index of findDuplicateDestinationIndexes(targets)) {
      context.addIssue({
        code: 'custom',
        path: ['targets', index, 'destination'],
        message: 'Each destination can only appear once.',
      })
    }
  })

export type PublishRequest = z.infer<typeof PublishRequestSchema>
