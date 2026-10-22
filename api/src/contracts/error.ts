import { z } from 'zod'

export const ApiErrorEnvelopeSchema = z
  .object({
    error: z.object({ code: z.string(), message: z.string() }).strict(),
  })
  .strict()

export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>
