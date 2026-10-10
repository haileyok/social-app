// Learn more https://docs.expo.io/guides/customizing-metro
import {getBundleModeMetroConfig} from 'react-native-worklets/bundleMode/index.js'
import {type CustomResolver} from '@expo/metro/metro-resolver'
import {getDefaultConfig} from '@expo/metro-config'

// (Unwrapped from @sentry/react-native's metro plugin during the bolide
// migration. That plugin called Expo's getDefaultConfig with this same
// customization callback, then added its own bits (sourcemap upload, React
// component annotation), which move to bolide-cli. Expo's own API is a plain
// call, so the callback body runs directly here.)
let config = getDefaultConfig(import.meta.dirname)

if (typeof process.env.RN_SRC_EXT === 'string') {
  // inject `.e2e.ts` and `.e2e.tsx` into the sourceExts when running tests)
  config.resolver.sourceExts.unshift(...process.env.RN_SRC_EXT.split(','))
}

config.resolver.assetExts = [...config.resolver.assetExts, 'woff2']

if (config.resolver.resolveRequest) {
  throw Error('Update this override because it is conflicting now.')
}

if (process.env.BSKY_PROFILE) {
  // @ts-expect-error readonly property
  config.cacheVersion += ':PROFILE'
}

const resolver: CustomResolver = (context, moduleName, platform) => {
  if (
    platform === 'web' &&
    /^react-native-gesture-handler(\/|$)/.test(moduleName)
  ) {
    throw new Error(
      `react-native-gesture-handler must not be imported on web (requested from ${context.originModulePath})`,
    )
  }
  /*
   * react-native-webview has no web implementation (its fallback renders
   * "does not support this platform"), so swap in react-native-web-webview
   * to keep external media embeds working. Mirrors the old webpack alias.
   */
  if (platform === 'web' && moduleName === 'react-native-webview') {
    return context.resolveRequest(
      context,
      'react-native-web-webview',
      platform,
    )
  }
  if (
    process.env.BSKY_PROFILE &&
    moduleName.endsWith('ReactNativeRenderer-prod')
  ) {
    return context.resolveRequest(
      context,
      moduleName.replace('-prod', '-profiling'),
      platform,
    )
  }
  return context.resolveRequest(context, moduleName, platform)
}

// @ts-expect-error readonly property
config.resolver.resolveRequest = resolver

config.transformer.getTransformOptions = () =>
  Promise.resolve({
    transform: {
      experimentalImportSupport: true,
      inlineRequires: true as false, // ??? typescript why?
    },
  })

config = getBundleModeMetroConfig(config)

export default config
