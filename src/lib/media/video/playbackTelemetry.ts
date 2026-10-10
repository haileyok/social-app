import {measureSpanStalls, startSpan} from '@bluesky/bolide'

/**
 * Where the video is being played.
 */
export type PlaybackSurface = 'feed' | 'immersiveFeed'

export type PlaybackTelemetry = {
  activated: (opts?: {preloaded?: boolean}) => void
  ready: () => void
  playing: () => void
  error: (e: unknown) => void
  deactivated: () => void
}

/**
 * bolide-only observability for video playback in feeds. Opens a root span
 * per activation window (the video becomes the active, autoplaying one)
 * and ends it on deactivation, with time-to-ready and time-to-first-play
 * timings as attributes. While the span is active, JS stall and slow/frozen
 * frame measurements attach to it - the playback-smoothness signal.
 *
 * Does not report to the analytics pipeline, only bolide.
 */
export function createPlaybackTelemetry({
  surface,
  presentation,
}: {
  surface: PlaybackSurface
  presentation: 'video' | 'gif'
}): PlaybackTelemetry {
  let span: ReturnType<typeof startSpan> | undefined
  let stallMeasurement: ReturnType<typeof measureSpanStalls> | undefined
  let activatedAt = 0
  let sawReady = false
  let sawPlaying = false

  function end(outcome: 'ok' | 'error') {
    if (!span) return
    stallMeasurement?.end()
    stallMeasurement = undefined
    span.setAttribute('outcome', outcome)
    span.end()
    span = undefined
  }

  return {
    activated(opts) {
      if (span) return
      activatedAt = Date.now()
      sawReady = false
      sawPlaying = false
      span = startSpan('video.playback', 'video.playback', {
        surface,
        presentation,
        ...(opts?.preloaded !== undefined && {preloaded: opts.preloaded}),
      })
      stallMeasurement = measureSpanStalls(span)
    },

    ready() {
      if (!span || sawReady) return
      sawReady = true
      span.setAttribute('timeToReadyMs', Date.now() - activatedAt)
    },

    playing() {
      if (!span || sawPlaying) return
      sawPlaying = true
      span.setAttribute('timeToFirstPlayMs', Date.now() - activatedAt)
    },

    error(e) {
      if (!span) return
      span.setAttribute('errorMessage', String(e).slice(0, 256))
      end('error')
    },

    deactivated() {
      end('ok')
    },
  }
}
