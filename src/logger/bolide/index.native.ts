/**
 * Native variant of the bolide reporting module.
 *
 * Same shared surface. Offline persistence and relaunch flush (delayed,
 * bursty offline events with old timestamps) land here in the native phase;
 * the current milestone is envelope comparison on web.
 */
export {captureError, captureMessage, setupBolide} from './index'
