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
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  captureError,
  captureMessage,
  flush,
  init,
  installAutomaticCaptures,
  requeueEvent,
  setPersistence,
  type PersistenceStore,
} from '@bluesky/bolide'

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

/*
 * Offline persistence: the client's unflushed queue survives app death and
 * flushes at relaunch (delayed, bursty offline events with old
 * timestamps). AsyncStorage is the platform store - the same store the
 * app's persisted state uses.
 */
function bolidePersistenceStore(): PersistenceStore {
  return {
    load: async () => {
      try {
        return await AsyncStorage.getItem('bolide.queue.v1')
      } catch {
        return null
      }
    },
    save: async (state: string) => {
      try {
        await AsyncStorage.setItem('bolide.queue.v1', state)
      } catch {
        // Best-effort: storage full or unavailable must not crash the app.
      }
    },
    clear: async () => {
      try {
        await AsyncStorage.removeItem('bolide.queue.v1')
      } catch {}
    },
  }
}

// Import side effect, matching the Sentry setup module: init, persistence,
// then the automatic captures (RN ErrorUtils/Hermes handlers + breadcrumbs).
if (setupBolide()) {
  void setPersistence(bolidePersistenceStore(), {
    prependEvents: events => {
      for (const event of events) {
        requeueEvent(event)
      }
    },
    prependSpans: () => {
      // Spans from a previous session are diagnostics: dropped rather
      // than re-synthesized (the span re-queue path lands with the native
      // span phase).
    },
  })
  installAutomaticCaptures()
  // Relaunch flush: whatever the load brought back rides out immediately
  // (the ingestion service accepts old timestamps; implausible ones fall
  // back to received_at).
  setTimeout(() => {
    void flush(5000).catch(() => {})
  }, 3000)
}
