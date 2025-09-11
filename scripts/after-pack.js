const fs = require('fs')
const path = require('path')

exports.default = async function (context) {
  const platform = context.packager.platform.name
  if (platform === 'windows') {
    fs.rmSync(path.join(context.appOutDir, 'LICENSE.electron.txt'), { force: true })
    fs.rmSync(path.join(context.appOutDir, 'LICENSES.chromium.html'), { force: true })
  }

  // Clean up resources/styles directory from project root after packing
  const projectRoot = path.resolve(__dirname, '..')
  const resourcesStylesPath = path.join(projectRoot, 'resources', 'styles')

  try {
    if (fs.existsSync(resourcesStylesPath)) {
      fs.rmSync(resourcesStylesPath, { recursive: true, force: true })
      console.log('✓ Cleaned up resources/styles directory from project root')
    }
  } catch (error) {
    console.warn('Warning: Could not clean up resources/styles directory:', error.message)
  }
}
