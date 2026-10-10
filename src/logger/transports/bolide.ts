/**
 * bolide transport for the app logger: same Transport interface as the
 * console/sentry transports, forwarding errors and messages to the bolide
 * client. Capture stays fire-and-forget; batching and flush timing belong
 * to the client.
 */
import * as bolide from '@bluesky/bolide'

import {LogLevel, type Metadata, type Transport} from '#/logger/types'
import {prepareMetadata} from '#/logger/util'

/**
 * bolide captures error objects with stacks; plain messages go through as
 * message events. Metadata rides along later (attachment/tag support); for
 * now anything that is an Error carries the useful part automatically.
 */
export const bolideTransport: Transport = (
  level,
  _context,
  message,
  metadata,
) => {
  if (level === LogLevel.Debug) return

  const prepared = prepareMetadata(metadata ?? {})

  // Find an Error in the message or metadata; otherwise capture a message.
  if (message instanceof Error) {
    bolide.captureError(message, `app.logger.${level}`)
    return
  }
  for (const value of Object.values(prepared)) {
    if (value instanceof Error) {
      bolide.captureError(value, `app.logger.${level}`)
      return
    }
  }
  if (typeof message === 'string') {
    bolide.captureMessage(message)
  }
}
