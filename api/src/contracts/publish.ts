import { z } from 'zod'

import {
  HatenaOptionsSchema,
  MastodonOptionsSchema,
  PublishDestinationIdSchema,
  RaindropOptionsSchema,
} from '#contracts/destination'
import { HttpUrlSchema } from '#contracts/http'

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

export const PublishRequestSchema = z
  .object({
    article: z
      .object({ url: HttpUrlSchema, title: z.string().optional() })
      .strict(),
    targets: z.array(PublishTargetSchema).min(1),
  })
  .strict()
  .superRefine(({ targets }, context) => {
    const seen = new Set<z.infer<typeof PublishDestinationIdSchema>>()

    for (const [index, { destination }] of targets.entries()) {
      if (seen.has(destination)) {
        context.addIssue({
          code: 'custom',
          path: ['targets', index, 'destination'],
          message: 'Each destination can only appear once.',
        })
      }

      seen.add(destination)
    }
  })

export type PublishRequest = z.infer<typeof PublishRequestSchema>
