import { z } from 'zod'

import { PublishDestinationIdSchema } from '#contracts/destination'
import { HttpUrlSchema } from '#contracts/http'

const DeliveryResultFields = {
  destination: PublishDestinationIdSchema,
  operationId: z.uuid(),
  remoteUrl: HttpUrlSchema.optional(),
  message: z.string().optional(),
}

export const DeliveryResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      ...DeliveryResultFields,
      status: z.literal('succeeded'),
      retryable: z.literal(false),
    })
    .strict(),
  z
    .object({
      ...DeliveryResultFields,
      status: z.literal('failed'),
      retryable: z.boolean(),
    })
    .strict(),
  z
    .object({
      ...DeliveryResultFields,
      status: z.literal('unknown'),
      retryable: z.literal(false),
    })
    .strict(),
])

export type DeliveryResult = z.infer<typeof DeliveryResultSchema>
