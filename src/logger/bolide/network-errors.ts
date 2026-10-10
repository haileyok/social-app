/**
 * Ported from #/logger/sentry/network-errors (the Sentry migration): bolide
 * should not report expected transport failures or transient upstream
 * availability errors. Same matching rules, bolide event shape.
 *
 * Used as the bolide client's beforeSend: automatic captures (global error
 * handlers) and logger transports both pass through it.
 */
import {XrpcResponseError} from '@atproto/lex'
import type {ErrorEvent} from '@bluesky/bolide'

import {isNetworkError, safeStringify} from '#/lib/network-error'

/**
 * Upstream-unavailable statuses. Matched on the status, not the lexicon
 * code: the PDS pipethrough rewrites the status to 502 but forwards the
 * upstream code verbatim, so a 502 can arrive named `InternalServerError`.
 */
const TRANSIENT_UPSTREAM_STATUSES = new Set([502, 503, 504])

/**
 * These match the message text: the payload message ("Upstream Timeout"),
 * the lexicon code ("UpstreamFailure"), and lex's payload-less "Upstream
 * server responded with a 504 error". Word boundaries keep camelCase
 * identifiers from matching.
 */
const TRANSIENT_UPSTREAM_MESSAGES = [
  /\bupstream\s?failure\b/i,
  /\bnot\s?enough\s?resources\b/i,
  /\bupstream\s?timeout\b/i,
  /operation timed out, please try again/i,
  /\bupstream server responded with a 50[234] error\b/i,
]

/**
 * bolide should not report expected transport failures or transient upstream
 * availability errors. Kept narrower than `XrpcError.shouldRetry()`:
 * fetch handlers can wrap implementation bugs, while 429s and generic 500s
 * can reveal actionable client or server regressions.
 */
export function isExpectedNetworkError(value: unknown): boolean {
  if (isNetworkError(value)) {
    return true
  }

  if (
    value instanceof XrpcResponseError &&
    TRANSIENT_UPSTREAM_STATUSES.has(value.status)
  ) {
    return true
  }

  const message = safeStringify(value)
  return (
    message !== undefined &&
    TRANSIENT_UPSTREAM_MESSAGES.some(pattern => pattern.test(message))
  )
}

/**
 * bolide beforeSend: drops expected network failures, passes everything
 * else. Message events are skipped (the only message producers are the
 * logger transport, already filtered, and user bug reports, never
 * droppable).
 */
export function dropExpectedNetworkErrors(
  event: ErrorEvent,
): ErrorEvent | null {
  const exceptions = event.exception?.values
  if (!exceptions?.length) {
    return event
  }

  const candidates: unknown[] = []

  for (const exception of exceptions) {
    candidates.push(exception.value)
    if (exception.type && exception.value) {
      candidates.push(`${exception.type}: ${exception.value}`)
    }
  }

  return candidates.some(isExpectedNetworkError) ? null : event
}
