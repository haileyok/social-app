/**
 * bolide error reporting module.
 *
 * Wraps the @bluesky/bolide client behind the app's platform-extension
 * convention so transport behavior differs per platform while the surface
 * stays one module. Web adds unload flush; native adds offline persistence
 * and relaunch flush (delayed offline events are a first-class case).
 *
 * Runs side by side with the Sentry setup for envelope comparison; the
 * DSN comes from the bolide-specific env var so the two stay independent.
 */
import {captureError, captureMessage, flush, init} from '@bluesky/bolide'

import * as env from '#/env'

export {captureError, captureMessage, flush}

/**
 * Initialize bolide. Like the Sentry setup, disabled in dev unless capture
 * mode is on. Returns false (and stays inert) when not configured.
 */
export function setupBolide() {
  const dsn = process.env.EXPO_PUBLIC_BOLIDE_DSN
  const forceCapture = process.env.EXPO_PUBLIC_BOLIDE_CAPTURE === '1'
  const enabled = dsn != null && (!env.IS_DEV || forceCapture)
  if (!enabled) return false
  return init({
    dsn: dsn,
    environment: env.ENV,
    release: env.RELEASE_VERSION,
    dist: env.BUNDLE_IDENTIFIER,
    sampleRate: env.IS_INTERNAL ? 1.0 : 0.1,
  })
}
