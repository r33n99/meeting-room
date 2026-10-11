import { setupWorker } from 'msw/browser'
import { createHandlers } from './handlers'
import { createDatabase } from './database'

let storage: Storage | undefined
try {
  storage = window.localStorage
} catch {
  /* In-memory fallback. */
}
export const worker = setupWorker(...createHandlers(createDatabase(storage)))
