/*
 * notarize for macOS
 *   via @electron/notarize (wraps Apple's `notarytool`)
 *   https://github.com/electron/notarize
 *
 * to configure, create an `electron-builder.env` with:
 *   APPLEID=...
 *   APPLEIDPASS=...
 *   APPLETEAMID=...
 * electron-builder will load these automatically before running this script.
 * APPLETEAMID is required by notarytool-based notarization (the old
 * altool-based flow that only needed appleId/appleIdPassword is retired).
 *
 * to skip signing and notarizing during development, use this env var:
 *   CSC_IDENTITY_AUTO_DISCOVERY=false
 *
 */

console.log('  + scripts/notarize.js')

if (
  process.env.hasOwnProperty('CSC_IDENTITY_AUTO_DISCOVERY') &&
  process.env.CSC_IDENTITY_AUTO_DISCOVERY == 'false'
) {
  console.log('    ... skipped because CSC_IDENTITY_AUTO_DISCOVERY was false')
  exports.default = async function notarizing (context) {}
} else {
  exports.default = async function notarizing (context) {
    if (context.electronPlatformName !== 'darwin') {
      console.log('    ... skipped because platform is not darwin')
      return
    }

    const { notarize } = require('@electron/notarize')

    let { appOutDir } = context
    let appName = context.packager.appInfo.productFilename
    let {
      APPLEID,
      APPLEIDPASS,
      APPLETEAMID,
    } = process.env

    let config = {
      appPath: `${appOutDir}/${appName}.app`,
      appleId: APPLEID,
      appleIdPassword: APPLEIDPASS,
      teamId: APPLETEAMID,
    }

    console.log('      • config for notarizing:')
    console.log({ config: { ...config, appleIdPassword: '(hidden)' } })

    return await notarize(config)
  }
}
