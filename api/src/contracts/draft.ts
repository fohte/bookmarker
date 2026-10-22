import { z } from 'zod'

import {
  ArticleSchema,
  SummarySchema,
  VerificationSchema,
} from '#contracts/article'
import { DeliveryResultSchema } from '#contracts/delivery'
import { DestinationDraftSchema } from '#contracts/destination'
import { PublishTargetSchema } from '#contracts/publish'
import { ShareInputSchema } from '#contracts/share-input'
import { findDuplicateDestinationIndexes } from '#contracts/unique-destinations'

const DeliverySnapshotSchema = z
  .object({
    target: PublishTargetSchema,
    result: DeliveryResultSchema.optional(),
  })
  .strict()

const AnalysisSchema = z
  .object({
    summary: SummarySchema.optional(),
    verification: VerificationSchema.optional(),
  })
  .strict()

export const BookmarkDraftSchema = z
  .object({
    version: z.literal(1),
    id: z.uuid(),
    source: ShareInputSchema,
    article: ArticleSchema.optional(),
    commonComment: z.string(),
    destinations: z.array(DestinationDraftSchema).default([]),
    delivery: z.array(DeliverySnapshotSchema).default([]),
    analysis: AnalysisSchema.optional(),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .superRefine(({ destinations }, context) => {
    for (const index of findDuplicateDestinationIndexes(destinations)) {
      context.addIssue({
        code: 'custom',
        path: ['destinations', index, 'destination'],
        message: 'Each destination can only appear once.',
      })
    }
  })

export type BookmarkDraft = z.infer<typeof BookmarkDraftSchema>
