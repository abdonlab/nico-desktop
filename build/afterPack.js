// Firma ad-hoc automática en macOS (necesaria para abrir en Apple Silicon).
// Antes de firmar, limpia atributos extendidos ("detritus") que impiden la firma
// cuando el proyecto vive en Documents/iCloud.
const { execSync } = require('child_process');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return; // solo Mac
  const appName = context.packager.appInfo.productFilename; // "NICO"
  const appPath = `${context.appOutDir}/${appName}.app`;
  try {
    execSync(`xattr -cr "${appPath}"`, { stdio: 'inherit' });   // limpia detritus
    execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
    console.log('  • firma ad-hoc aplicada a', appPath);
  } catch (e) {
    console.warn('  • no se pudo firmar ad-hoc:', e.message);
  }
};
