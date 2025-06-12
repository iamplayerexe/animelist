// forge.config.js
require('dotenv').config();

const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    // Using a base name for the icon is best practice.
    // Forge will append .ico for Windows and .icns for macOS.
    icon: './src/assets/app-logo', 
    appCopyright: `Copyright ©️ ${new Date().getFullYear()} Xutron`,
    win32metadata: {
      CompanyName: 'Xutron',
      ProductName: 'AnimeList',
      FileDescription: 'Application to manage your anime list.',
    }
  },

  rebuildConfig: {},

  // This is the corrected list of makers.
  // No 'platforms' arrays are needed. Forge handles this automatically.
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: "AnimeList",
        setupIcon: './src/assets/app-logo.ico',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      // The 'platforms' array has been removed.
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
          options: {
              maintainer: 'Xutron',
              homepage: 'https://github.com/iamplayerexe/animelist',
              icon: './src/assets/app.png',
              productName: 'AnimeList',
              license: 'MIT'
          }
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
          options: {
              maintainer: 'Xutron',
              homepage: 'https://github.com/iamplayerexe/animelist',
              icon: './src/assets/app.png',
              productName: 'AnimeList',
              license: 'MIT'
          }
      },
    },
  ],

  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],

  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'iamplayerexe',
          name: 'animelist'
        },
        authToken: process.env.GITHUB_TOKEN,
        prerelease: false,
        draft: false
      }
    }
  ]
};