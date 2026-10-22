import { z } from 'zod'

export const HttpUrlSchema = z.url({ protocol: /^https?$/ })
export const ArticleTextSchema = z
  .string()
  .refine((value) => value.length <= 100_000, {
    message: 'Text must be at most 100000 UTF-16 code units.',
  })
