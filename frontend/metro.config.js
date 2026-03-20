const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// WSL2 fix: inotify doesn't fire on /mnt/c/ (Windows NTFS) paths.
// Disabling recrawl prevents watchman from getting stuck and falling silent.
process.env.WATCHMAN_DISABLE_RECRAWL = '1';

// Explicitly tell Metro where to watch so it doesn't miss the project root.
config.watchFolders = [path.resolve(__dirname)];

config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

config.server = {
  ...config.server,
  port: 8081,
};

module.exports = config;
