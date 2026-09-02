const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable the experimental package-exports resolver.
// react-native-svg 15.x ships TypeScript source with no `exports` field, and
// this flag causes Metro to fail resolving internal relative TS paths like
// ./lib/extract/types even though the file exists on disk.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
