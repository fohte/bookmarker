import { z } from 'zod'

import { ArticleTextSchema, HttpUrlSchema } from '#contracts/http'

export const ShareInputSchema = z
  .object({
    version: z.literal(1),
    url: HttpUrlSchema,
    title: z.string().optional(),
    sharedText: ArticleTextSchema.optional(),
    partial: z.boolean().default(false),
  })
  .strict()

export type ShareInput = z.infer<typeof ShareInputSchema>
