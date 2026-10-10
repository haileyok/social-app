import {init} from '@sentry/browser'

import {featureFlagsIntegration} from '#/logger/sentry/featureFlags'
import {dropExpectedNetworkErrors} from '#/logger/sentry/network-errors'
import * as env from '#/env'

/*
 * Web counterpart of ./index.ts. Initializing `@sentry/browser` directly
 * instead of `@sentry/react-native` keeps the RN SDK layer (native wrapper,
 * RN tracing, feedback widget, RN integrations - roughly 200KB minified) out
 * of the web bundle. Options mirror the native setup; RN-only options are
 * omitted.
 */
/*
 * bolide-capture harness: EXPO_PUBLIC_BOLIDE_CAPTURE=1 force-enables the SDK
 * in dev (where IS_DEV would otherwise disable it), samples at 1.0, and turns
 * on SDK debug output, so real envelopes always reach the capture server.
 */
const FORCE_CAPTURE = process.env.EXPO_PUBLIC_BOLIDE_CAPTURE === '1'

init({
  enabled: FORCE_CAPTURE || (!env.IS_DEV && !!env.SENTRY_DSN),
  dsn: env.SENTRY_DSN,
  sendDefaultPii: true,
  debug: FORCE_CAPTURE, // If `true`, Sentry will try to print out useful debugging information if something goes wrong with sending the event. Set it to `false` in production
  environment: env.ENV,
  dist: env.BUNDLE_IDENTIFIER,
  release: env.RELEASE_VERSION,
  beforeSend: dropExpectedNetworkErrors,
  ignoreErrors: [
    /*
     * Unknown internals errors
     */
    `t is not defined`,
    `Can't find variable: t`,
  ],
  /**
   * Does not affect traces of error events or other logs, just disables
   * automatically attaching stack traces to events. This helps us group events
   * and prevents explosions of separate issues.
   *
   * @see https://docs.sentry.io/platforms/react-native/configuration/options/#attach-stacktrace
   */
  attachStacktrace: false,
  sampleRate: FORCE_CAPTURE ? 1.0 : env.IS_INTERNAL ? 1.0 : 0.1,
  /**
   * Sample rate for performance spans (video playback, video upload). Setting
   * this also enables the SDK's default stall and slow/frozen frame tracking,
   * whose measurements attach to every root span.
   */
  tracesSampleRate: env.IS_INTERNAL ? 1.0 : 0.01,
  /*
   * The native setup passes `enableAutoSessionTracking: false`. The browser
   * SDK's equivalent is the BrowserSession default integration, so filter it
   * out to match.
   */
  integrations: defaults => [
    ...defaults.filter(i => i.name !== 'BrowserSession'),
    featureFlagsIntegration,
  ],
})
