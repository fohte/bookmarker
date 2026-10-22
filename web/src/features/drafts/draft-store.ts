import { type BookmarkDraft, BookmarkDraftSchema } from 'api/contracts'
import {
  err,
  errAsync,
  ok,
  okAsync,
  type Result,
  ResultAsync,
} from 'neverthrow'

import { asStorageError, DraftError } from '#features/drafts/draft-error'

const databaseName = 'bookmarker-local-drafts'
const databaseVersion = 1
const draftsStoreName = 'drafts'
const importsStoreName = 'imports'
const importsByDraftIndex = 'by-draft-id'

type ImportReceipt = {
  importId: string
  draftId: string
}

export type DraftListing = {
  drafts: BookmarkDraft[]
  unreadableCount: number
}

export interface DraftStore {
  listDrafts(): ResultAsync<DraftListing, DraftError>
  getDraft(id: string): ResultAsync<BookmarkDraft | null, DraftError>
  addDraft(draft: BookmarkDraft): ResultAsync<void, DraftError>
  saveDraft(draft: BookmarkDraft): ResultAsync<void, DraftError>
  commitImport(
    importId: string,
    draft: BookmarkDraft,
  ): ResultAsync<BookmarkDraft, DraftError>
  deleteDraft(id: string): ResultAsync<void, DraftError>
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable.'))
      return
    }

    const request = indexedDB.open(databaseName, databaseVersion)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(draftsStoreName)) {
        database.createObjectStore(draftsStoreName, { keyPath: 'id' })
      }

      if (!database.objectStoreNames.contains(importsStoreName)) {
        const imports = database.createObjectStore(importsStoreName, {
          keyPath: 'importId',
        })
        imports.createIndex(importsByDraftIndex, 'draftId')
      }
    }

    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close()
      }
      resolve(request.result)
    }
    request.onerror = () => {
      reject(request.error ?? new Error('Database open failed.'))
    }
    request.onblocked = () => {
      reject(new Error('Database upgrade is blocked.'))
    }
  })
}

function runTransaction<T>(
  stores: string | string[],
  mode: IDBTransactionMode,
  configure: (
    transaction: IDBTransaction,
    setResult: (value: T) => void,
  ) => void,
): Promise<T> {
  return openDatabase().then((database) => {
    const result = new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(stores, mode)
      let value: T
      let hasValue = false

      transaction.oncomplete = () => {
        if (hasValue) {
          resolve(value)
        } else {
          reject(new Error('Database transaction completed without a result.'))
        }
      }
      transaction.onabort = () => {
        reject(transaction.error ?? new Error('Database transaction aborted.'))
      }

      configure(transaction, (nextValue) => {
        value = nextValue
        hasValue = true
      })
    })

    return result.finally(() => {
      database.close()
    })
  })
}

function transactionResult<T>(
  stores: string | string[],
  mode: IDBTransactionMode,
  configure: (
    transaction: IDBTransaction,
    setResult: (value: T) => void,
  ) => void,
): ResultAsync<T, DraftError> {
  return ResultAsync.fromPromise(
    runTransaction(stores, mode, configure),
    asStorageError,
  )
}

function parseDraft(value: unknown) {
  const parsed = BookmarkDraftSchema.safeParse(value)
  if (!parsed.success) {
    return err(
      new DraftError(
        'invalid-draft',
        'This saved draft has an unsupported or invalid format and was left unchanged.',
      ),
    )
  }

  return ok(parsed.data)
}

function isImportReceipt(value: unknown): value is ImportReceipt {
  return (
    typeof value === 'object' &&
    value !== null &&
    'importId' in value &&
    typeof value.importId === 'string' &&
    'draftId' in value &&
    typeof value.draftId === 'string'
  )
}

function validateDraft(
  draft: BookmarkDraft,
): Result<BookmarkDraft, DraftError> {
  return parseDraft(draft)
}

export function createIndexedDbDraftStore(): DraftStore {
  return {
    listDrafts() {
      return transactionResult<unknown[]>(
        draftsStoreName,
        'readonly',
        (transaction, setResult) => {
          const request = transaction.objectStore(draftsStoreName).getAll()
          request.onsuccess = () => {
            setResult(request.result)
          }
        },
      ).map((values) => {
        const drafts: BookmarkDraft[] = []
        let unreadableCount = 0

        for (const value of values) {
          const parsed = parseDraft(value)
          if (parsed.isOk()) {
            drafts.push(parsed.value)
          } else {
            unreadableCount += 1
          }
        }

        drafts.sort((left, right) =>
          right.updatedAt.localeCompare(left.updatedAt),
        )
        return { drafts, unreadableCount }
      })
    },

    getDraft(id) {
      return transactionResult<unknown>(
        draftsStoreName,
        'readonly',
        (transaction, setResult) => {
          const request = transaction.objectStore(draftsStoreName).get(id)
          request.onsuccess = () => {
            setResult(request.result)
          }
        },
      ).andThen((value) => {
        if (value === undefined) {
          return okAsync(null)
        }

        const parsed = parseDraft(value)
        return parsed.isOk() ? okAsync(parsed.value) : errAsync(parsed.error)
      })
    },

    addDraft(draft) {
      const validated = validateDraft(draft)
      if (validated.isErr()) {
        return errAsync(validated.error)
      }

      return transactionResult<undefined>(
        draftsStoreName,
        'readwrite',
        (transaction, setResult) => {
          transaction
            .objectStore(draftsStoreName)
            .add(structuredClone(validated.value))
          setResult(undefined)
        },
      )
    },

    saveDraft(draft) {
      const validated = validateDraft(draft)
      if (validated.isErr()) {
        return errAsync(validated.error)
      }

      return transactionResult<undefined>(
        draftsStoreName,
        'readwrite',
        (transaction, setResult) => {
          transaction
            .objectStore(draftsStoreName)
            .put(structuredClone(validated.value))
          setResult(undefined)
        },
      )
    },

    commitImport(importId, draft) {
      const validated = validateDraft(draft)
      if (validated.isErr()) {
        return errAsync(validated.error)
      }

      return transactionResult<unknown>(
        [draftsStoreName, importsStoreName],
        'readwrite',
        (transaction, setResult) => {
          const drafts = transaction.objectStore(draftsStoreName)
          const imports = transaction.objectStore(importsStoreName)
          const receiptRequest = imports.get(importId)

          receiptRequest.onsuccess = () => {
            if (receiptRequest.result !== undefined) {
              if (!isImportReceipt(receiptRequest.result)) {
                setResult(undefined)
                return
              }

              const existingDraftRequest = drafts.get(
                receiptRequest.result.draftId,
              )
              existingDraftRequest.onsuccess = () => {
                setResult(existingDraftRequest.result)
              }
              return
            }

            const snapshot = structuredClone(validated.value)
            drafts.add(snapshot)
            imports.add({
              importId,
              draftId: snapshot.id,
            } satisfies ImportReceipt)
            setResult(snapshot)
          }
        },
      ).andThen((value) => {
        if (value === undefined) {
          return errAsync(
            new DraftError(
              'invalid-draft',
              'The saved share receipt could not be read. The original URL was kept.',
            ),
          )
        }

        const parsed = parseDraft(value)
        return parsed.isOk() ? okAsync(parsed.value) : errAsync(parsed.error)
      })
    },

    deleteDraft(id) {
      return transactionResult<undefined>(
        [draftsStoreName, importsStoreName],
        'readwrite',
        (transaction, setResult) => {
          const drafts = transaction.objectStore(draftsStoreName)
          const imports = transaction.objectStore(importsStoreName)
          const receipts = imports.index(importsByDraftIndex).getAllKeys(id)

          receipts.onsuccess = () => {
            for (const receiptKey of receipts.result) {
              imports.delete(receiptKey)
            }
            drafts.delete(id)
            setResult(undefined)
          }
        },
      )
    },
  }
}
