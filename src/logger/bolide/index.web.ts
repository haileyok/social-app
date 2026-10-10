/**
 * Web variant of the bolide reporting module.
 *
 * Same shared surface, plus page-hide flush: visibilitychange to hidden is
 * the last reliable send moment in browsers; pagehide/unload fire too late
 * for fetch in some engines.
 */
import {flush} from '@bluesky/bolide'

export {captureError, captureMessage, setupBolide} from './index.js'

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void flush(1000).catch(() => {})
    }
  })
}
