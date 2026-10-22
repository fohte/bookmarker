import { z } from 'zod'

export const DestinationIdSchema = z.enum([
  'hatena',
  'mastodon',
  'raindrop',
  'x',
])

export type DestinationId = z.infer<typeof DestinationIdSchema>

export const PublishDestinationIdSchema = z.enum([
  'hatena',
  'mastodon',
  'raindrop',
])

export type PublishDestinationId = z.infer<typeof PublishDestinationIdSchema>

export const HatenaOptionsSchema = z
  .object({ tags: z.array(z.string()), private: z.boolean() })
  .strict()

export type HatenaOptions = z.infer<typeof HatenaOptionsSchema>

export const MastodonOptionsSchema = z
  .object({
    visibility: z.enum(['public', 'unlisted', 'private', 'direct']),
    spoilerText: z.string(),
    sensitive: z.boolean(),
  })
  .strict()

export type MastodonOptions = z.infer<typeof MastodonOptionsSchema>

export const RaindropOptionsSchema = z
  .object({ collectionId: z.number().int(), tags: z.array(z.string()) })
  .strict()

export type RaindropOptions = z.infer<typeof RaindropOptionsSchema>

const DestinationDraftFields = {
  selected: z.boolean(),
  commentMode: z.enum(['common', 'custom']),
  customComment: z.string().default(''),
}

export const DestinationDraftSchema = z.discriminatedUnion('destination', [
  z
    .object({
      ...DestinationDraftFields,
      destination: z.literal('hatena'),
      options: HatenaOptionsSchema,
    })
    .strict(),
  z
    .object({
      ...DestinationDraftFields,
      destination: z.literal('mastodon'),
      options: MastodonOptionsSchema,
    })
    .strict(),
  z
    .object({
      ...DestinationDraftFields,
      destination: z.literal('raindrop'),
      options: RaindropOptionsSchema,
    })
    .strict(),
  z.object({ ...DestinationDraftFields, destination: z.literal('x') }).strict(),
])

export type DestinationDraft = z.infer<typeof DestinationDraftSchema>
