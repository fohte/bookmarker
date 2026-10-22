import { err, ok, Result, type Result as ResultType } from 'neverthrow'
import { z } from 'zod'

import type { AnalysisFailure } from '#analysis/types'

const NonEmptyTextSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0)

const SummarySuccessSchema = z
  .object({
    status: z.literal('ok'),
    summary: NonEmptyTextSchema.max(4000),
  })
  .strict()

const InsufficientSchema = z
  .object({ status: z.literal('insufficient') })
  .strict()

const SummaryModelResponseSchema = z.discriminatedUnion('status', [
  SummarySuccessSchema,
  InsufficientSchema,
])

const ErrorIssueSchema = z
  .object({
    kind: z.literal('error'),
    quote: NonEmptyTextSchema,
    reason: NonEmptyTextSchema,
    evidence: NonEmptyTextSchema,
  })
  .strict()

const UnsupportedIssueSchema = z
  .object({
    kind: z.literal('unsupported'),
    quote: NonEmptyTextSchema,
    reason: NonEmptyTextSchema,
    evidence: NonEmptyTextSchema.optional(),
  })
  .strict()

const UncertainIssueSchema = z
  .object({
    kind: z.literal('uncertain'),
    quote: NonEmptyTextSchema,
    reason: NonEmptyTextSchema,
    evidence: NonEmptyTextSchema.optional(),
  })
  .strict()

const VerificationSuccessSchema = z
  .object({
    status: z.literal('ok'),
    issues: z
      .array(
        z.discriminatedUnion('kind', [
          ErrorIssueSchema,
          UnsupportedIssueSchema,
          UncertainIssueSchema,
        ]),
      )
      .max(20),
  })
  .strict()

const VerificationModelResponseSchema = z.discriminatedUnion('status', [
  VerificationSuccessSchema,
  InsufficientSchema,
])

export type SummaryModelResponse = z.infer<typeof SummaryModelResponseSchema>
export type VerificationModelResponse = z.infer<
  typeof VerificationModelResponseSchema
>

const parseJson = (content: string): ResultType<unknown, AnalysisFailure> =>
  Result.fromThrowable(
    () => JSON.parse(content) as unknown,
    (): AnalysisFailure => ({ kind: 'invalid-response' }),
  )()

const parseModelResponse = <Schema extends z.ZodType>(
  schema: Schema,
  content: string,
): ResultType<z.infer<Schema>, AnalysisFailure> => {
  const json = parseJson(content)
  if (json.isErr()) {
    return err(json.error)
  }

  const parsed = schema.safeParse(json.value)
  return parsed.success ? ok(parsed.data) : err({ kind: 'invalid-response' })
}

export const parseSummaryModelResponse = (
  content: string,
): ResultType<SummaryModelResponse, AnalysisFailure> =>
  parseModelResponse(SummaryModelResponseSchema, content)

export const parseVerificationModelResponse = (
  content: string,
): ResultType<VerificationModelResponse, AnalysisFailure> =>
  parseModelResponse(VerificationModelResponseSchema, content)
