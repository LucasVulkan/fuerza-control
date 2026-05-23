const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the workspace root so we can import from ../../src (web utilities & data)
config.watchFolders = [workspaceRoot];

// Resolve modules from both mobile/node_modules and root/node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Disable the experimental package-exports resolver.
// react-native-svg 15.x ships TypeScript source with no `exports` field, and
// this flag causes Metro to fail resolving internal relative TS paths like
// ./lib/extract/types even though the file exists on disk.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
