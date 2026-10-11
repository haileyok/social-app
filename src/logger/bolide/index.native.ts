/**
 * Native variant of the bolide error reporting module.
 *
 * Self-contained like the Sentry setup variants: imports everything from
 * @bluesky/bolide directly, no cross-variant imports (they resolve circularly
 * once the platform resolver swaps this file in).
 *
 * Offline persistence and relaunch flush (delayed, bursty offline events
 * with old timestamps) land here in the native phase; the current milestone
 * is envelope comparison on web.
 */
import {captureError, captureMessage, init, installAutomaticCaptures} from '@bluesky/bolide'

import * as env from '#/env'

export {captureError, captureMessage}

/**
 * Initialize bolide. Disabled in dev unless capture mode is on; DSN comes
 * from the bolide-specific env so the two systems run side by side.
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
  })
}

// Import side effect, matching the Sentry setup module: init, then the
// automatic captures (RN ErrorUtils/Hermes handlers + breadcrumb ring).
if (setupBolide()) {
  installAutomaticCaptures()
}
