/**
 * Expo config plugin: bolide native crash capture (Android).
 *
 * The Kotlin handler (BolideNativeCrashHandler) cannot live in the
 * android/ directory - it is prebuild output, regenerated (and
 * gitignored). This plugin injects it at prebuild time:
 *   - writes BolideNativeCrashHandler.kt into the app package (the
 *     namespace in android/app/build.gradle names the package)
 *   - patches MainApplication.onCreate to install the handler
 * Idempotent: re-running prebuild detects the existing install and
 * leaves it alone.
 */

const fs = require('fs')
const path = require('path')
const {withDangerousMod} = require('expo/config-plugins')

const KOTLIN_SOURCE = path.join(__dirname, 'BolideNativeCrashHandler.kt.template')

const INSTALL_MARKER = 'BolideNativeCrashHandler.install(this)'
const INSTALL_COMMENT = [
  '    // bolide: native crash capture (fatal crashes never reach JS; the',
  '    // handler writes a crash record, then chains to the previous handler.',
  '    // The JS layer reads pending records at relaunch and re-queues them).',
  `    ${INSTALL_MARKER}`,
].join('\n')

function withBolideNativeCrashHandler(config) {
  return withDangerousMod(config, ['android', async cfg => {
    const projectRoot = cfg._internal?.projectRoot
    const androidDir = projectRoot && path.join(projectRoot, 'android')
    if (!androidDir || !fs.existsSync(androidDir)) return cfg

    // The app package: the namespace in app/build.gradle (modern projects
    // carry it there; the manifest no longer has package=).
    const gradlePath = path.join(androidDir, 'app/build.gradle')
    if (!fs.existsSync(gradlePath)) return cfg
    const gradle = fs.readFileSync(gradlePath, 'utf8')
    const nsMatch = gradle.match(/namespace\s+'([\w.]+)'/)
    const pkg = nsMatch && nsMatch[1]
    if (!pkg) return cfg

    // Write the Kotlin handler into the app package.
    const kotlinDir = path.join(androidDir, 'app/src/main/java', ...pkg.split('.'))
    fs.mkdirSync(kotlinDir, {recursive: true})
    const template = fs.readFileSync(KOTLIN_SOURCE, 'utf8')
    const source = template.replace('__PACKAGE__', pkg)
    fs.writeFileSync(path.join(kotlinDir, 'BolideNativeCrashHandler.kt'), source)

    // Patch MainApplication.onCreate (idempotent).
    const mainAppFile = path.join(kotlinDir, 'MainApplication.kt')
    if (fs.existsSync(mainAppFile)) {
      let content = fs.readFileSync(mainAppFile, 'utf8')
      if (!content.includes(INSTALL_MARKER)) {
        content = content.replace(
          /(override fun onCreate\(\) \{\n\s*super\.onCreate\(\)\n)/,
          `$1${INSTALL_COMMENT}\n`,
        )
        fs.writeFileSync(mainAppFile, content)
      }
    }
    return cfg
  }])
}

module.exports = withBolideNativeCrashHandler
