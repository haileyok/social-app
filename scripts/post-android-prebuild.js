/* oxlint-disable import/no-nodejs-modules -- build-time script */

/**
 * Post-prebuild Android injection: the bolide native crash handler.
 *
 * Why a script and not an expo config plugin: prebuild re-templates
 * MainApplication.kt after the config-plugin mods run (observed: the
 * plugin's write at 05:12:36.957 was overwritten 15ms later), so plugin
 * injection into Kotlin sources does not survive prebuild. This script
 * runs after prebuild completes and is the last writer.
 *
 * Idempotent: safe to run repeatedly. Exits 0 silently when the android
 * directory is absent (web-only checkouts) or the namespace cannot be
 * found (log loudly; a missing handler must not fail the build).
 */

const fs = require('fs')
const path = require('path')

const projectRoot = path.join(__dirname, '..')
const androidDir = path.join(projectRoot, 'android')
const templatePath = path.join(
  projectRoot,
  'plugins/bolideNativeCrashHandler/BolideNativeCrashHandler.kt.template',
)

const INSTALL_MARKER = 'BolideNativeCrashHandler.install(this)'
const INSTALL_COMMENT = [
  '    // bolide: native crash capture (fatal crashes never reach JS; the',
  '    // handler writes a crash record, then chains to the previous handler.',
  '    // The JS layer reads pending records at relaunch and re-queues them).',
  `    ${INSTALL_MARKER}`,
].join('\n')

function main() {
  if (!fs.existsSync(androidDir)) {
    return
  }
  const gradlePath = path.join(androidDir, 'app/build.gradle')
  if (!fs.existsSync(gradlePath)) {
    console.error('post-android-prebuild: android/app/build.gradle not found; skipping')
    return
  }
  const gradle = fs.readFileSync(gradlePath, 'utf8')
  const nsMatch = gradle.match(/namespace\s+'([\w.]+)'/)
  if (!nsMatch) {
    console.error('post-android-prebuild: no namespace in app/build.gradle; skipping')
    return
  }
  const pkg = nsMatch[1]

  const kotlinDir = path.join(androidDir, 'app/src/main/java', ...pkg.split('.'))
  fs.mkdirSync(kotlinDir, {recursive: true})

  // The Kotlin handler.
  const template = fs.readFileSync(templatePath, 'utf8')
  const source = template.replace('__PACKAGE__', pkg)
  const handlerFile = path.join(kotlinDir, 'BolideNativeCrashHandler.kt')
  fs.writeFileSync(handlerFile, source)

  // Patch MainApplication.onCreate (idempotent).
  const mainAppFile = path.join(kotlinDir, 'MainApplication.kt')
  if (!fs.existsSync(mainAppFile)) {
    console.error('post-android-prebuild: MainApplication.kt not found; skipping patch')
    return
  }
  let content = fs.readFileSync(mainAppFile, 'utf8')
  if (!content.includes(INSTALL_MARKER)) {
    const patched = content.replace(
      /(override fun onCreate\(\) \{\n\s*super\.onCreate\(\)\n)/,
      `$1${INSTALL_COMMENT}\n`,
    )
    if (patched === content) {
      console.error(
        'post-android-prebuild: onCreate pattern not matched; handler written but not installed',
      )
      return
    }
    fs.writeFileSync(mainAppFile, patched)
  }
  console.log(`post-android-prebuild: bolide crash handler injected (${pkg})`)
}

main()
