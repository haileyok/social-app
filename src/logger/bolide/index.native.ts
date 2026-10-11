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
import {nativeApplicationVersion, nativeBuildVersion} from 'expo-application'
import {deviceName, isDevice, modelName, osName, osVersion} from 'expo-device'
import * as LegacyFileSystem from 'expo-file-system/legacy'
import {
  captureError,
  captureMessage,
  flush,
  init,
  installAutomaticCaptures,
  requeueEvent,
  setPersistence,
  setStaticContexts,
  startSpan,
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

/*
 * Native crash records: the Kotlin handler (BolideNativeCrashHandler)
 * writes one JSON file per crash type to the app's files dir when a
 * fatal crash kills the process (JS never sees those). At relaunch,
 * read the pending records, re-queue them as error events with their
 * crash-time timestamps, then delete the files.
 */
async function requeueNativeCrashes() {
  try {
    const dir = `${LegacyFileSystem.documentDirectory ?? ''}`.replace(/\/$/, '')
    // The Kotlin handler writes to filesDir/bolide-native-crashes/.
    // documentDirectory on Android is filesDir; append the subdir.
    const crashDir = `${dir}/bolide-native-crashes`
    const names = await LegacyFileSystem.readDirectoryAsync(crashDir).catch(() => [])
    for (const name of names) {
      if (!name.endsWith('.json')) continue
      const path = `${crashDir}/${name}`
      const raw = await LegacyFileSystem.readAsStringAsync(path).catch(() => null)
      if (!raw) continue
      try {
        const record = JSON.parse(raw) as {
          kind: string
          type: string
          message: string
          thread: string
          stack: string
          cause: string
          at_ms: number
          count: number
        }
        if (record.kind !== 'native_crash') continue
        captureError(
          new Error(
            `${record.type}: ${record.message}\n${record.stack}${record.cause ? '\n' + record.cause : ''}`,
          ),
          `auto.rn.nativecrash.${record.thread}${record.count > 1 ? `.x${record.count}` : ''}`,
        )
        // The re-queued event carries the crash time, not the relaunch
        // time: the ingestion service keeps plausible old timestamps.
        await LegacyFileSystem.deleteAsync(path, {idempotent: true}).catch(() => {})
      } catch {
        // Corrupt record: delete so it cannot loop forever.
        await LegacyFileSystem.deleteAsync(path, {idempotent: true}).catch(() => {})
      }
    }
  } catch {
    // Crash-record reading must never break the boot.
  }
}

// Import side effect, matching the Sentry setup module: init, persistence,
// device context, then the automatic captures (RN ErrorUtils/Hermes
// handlers + breadcrumbs).
if (setupBolide()) {
  // Device context: rides every event (the device/os signals Sentry
  // attached). Read once at boot; static for the session.
  setStaticContexts({
    device: {
      is_device: isDevice,
      model_name: modelName ?? undefined,
      device_name: deviceName ?? undefined,
    },
    os: {name: osName, version: osVersion},
    app: {
      version: nativeApplicationVersion ?? env.RELEASE_VERSION,
      build: nativeBuildVersion ?? env.BUNDLE_IDENTIFIER,
    },
  })

  // Cold start span: this module loads during the app's boot path, so
  // module-load time approximates the app start (this expo version has
  // no OS-reported start-time API; the span starts when the reporter
  // itself boots, which is early in MainApplication -> JS load).
  const coldStart = startSpan('app.start', 'app.start', {cold: true})
  // End after the boot path has settled (captures installed, load
  // issued, flush scheduled): duration = reporter boot -> settled.
  setTimeout(() => coldStart.end(), 100)

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
  // Native crash records from the Kotlin handler: re-queue before the
  // relaunch flush (they ride the same 3s drain).
  void requeueNativeCrashes()
  // Relaunch flush: whatever the load + crash records brought back rides
  // out immediately (the ingestion service accepts old timestamps;
  // implausible ones fall back to received_at).
  setTimeout(() => {
    void flush(5000).catch(() => {})
  }, 3000)
}
