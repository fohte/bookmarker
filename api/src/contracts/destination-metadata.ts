import { z } from 'zod'

const DestinationMetadataErrorSchema = z
  .object({
    code: z.enum([
      'unavailable',
      'unauthorized',
      'rate_limited',
      'invalid_response',
    ]),
    message: z.string().min(1).max(200),
  })
  .strict()

export type DestinationMetadataError = z.infer<
  typeof DestinationMetadataErrorSchema
>

const CollectionSchema = z
  .object({
    id: z.number().int(),
    title: z.string(),
    parentId: z.number().int().optional(),
    public: z.boolean(),
  })
  .strict()

export const DestinationMetadataSchema = z
  .object({
    destinations: z
      .object({
        hatena: z.object({ configured: z.boolean() }).strict(),
        mastodon: z
          .object({
            configured: z.boolean(),
            maxCharacters: z.number().int().positive().optional(),
            charactersReservedPerUrl: z.number().int().nonnegative().optional(),
            metadataError: DestinationMetadataErrorSchema.optional(),
          })
          .strict(),
        raindrop: z
          .object({
            configured: z.boolean(),
            collections: z.array(CollectionSchema).optional(),
            metadataError: DestinationMetadataErrorSchema.optional(),
          })
          .strict(),
        x: z.object({ configured: z.literal(true) }).strict(),
      })
      .strict(),
  })
  .strict()

export type DestinationMetadata = z.infer<typeof DestinationMetadataSchema>
