import { z } from 'zod'

import { ArticleTextSchema, HttpUrlSchema } from '#contracts/http'

export const ArticleSchema = z
  .object({
    url: HttpUrlSchema,
    title: z.string(),
    text: ArticleTextSchema,
    source: z.enum(['shared', 'fetched', 'manual']),
    partial: z.boolean(),
  })
  .strict()

export type Article = z.infer<typeof ArticleSchema>

export const SummarySchema = z
  .object({ summary: z.string(), partial: z.boolean() })
  .strict()

export type Summary = z.infer<typeof SummarySchema>

export const VerificationSchema = z
  .object({
    issues: z.array(
      z
        .object({
          kind: z.enum(['error', 'unsupported', 'uncertain']),
          quote: z.string(),
          reason: z.string(),
          evidence: z.string().optional(),
        })
        .strict(),
    ),
    partial: z.boolean(),
  })
  .strict()

export type Verification = z.infer<typeof VerificationSchema>
