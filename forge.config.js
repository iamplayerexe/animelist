require('dotenv').config();

const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: "./src/assets/app-logo",
    appCopyright: `Copyright © ${new Date().getFullYear()} Xutron`,
    win32metadata: {
      CompanyName: 'Xutron',
      ProductName: 'AnimeList',
      FileDescription: 'Application to manage and track anime.',
    }
  },

  rebuildConfig: {},

  makers: [
    {
      // Windows installer
      name: '@electron-forge/maker-squirrel',
      config: {
        name: "AnimeList", // A name without spaces is safer
        setupIcon: './src/assets/app-logo.ico',
      },
    },
    {
      // UPDATED: Changed from maker-zip to maker-dmg for a better macOS experience
      name: '@electron-forge/maker-dmg',
      config: {
        icon: './src/assets/app-logo.icns',
        name: 'AnimeList',
      }
    },
    {
      // Linux .deb installer
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'Xutron',
          homepage: 'https://github.com/iamplayerexe/animelist',
          icon: './src/assets/app-logo.png',
          productName: 'AnimeList',
          license: 'MIT'
        }
      },
    },
    {
      // Linux .rpm installer
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          maintainer: 'Xutron',
          homepage: 'https://github.com/iamplayerexe/animelist',
          icon: './src/assets/app-logo.png',
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
        // UPDATED: This now points to your PRIVATE repository for releases
        repository: {
          owner: 'iamplayerexe',
          name: 'animelist_app' // IMPORTANT: Change if your private repo has a different name
        },
        authToken: process.env.GITHUB_TOKEN, // This will be provided by the workflow secret
        prerelease: false,
        draft: false
      }
    }
  ]
};