require('dotenv').config();

const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: './src/assets/app-logo', 
    appCopyright: `Copyright © ${new Date().getFullYear()} Xutron`,
    win32metadata: {
      CompanyName: 'Xutron',
      ProductName: 'AnimeList',
      FileDescription: 'Application to manage your anime list.',
    }
  },

  rebuildConfig: {},

  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        name: "AnimeList",
        setupIcon: './src/assets/app-logo.ico',
      },
    },
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
      config: {
        icon: './src/assets/app-logo.icns',
        name: 'AnimeList'
      },
    },
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
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
      platforms: ['linux'],
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
        // This should point to your PRIVATE releases repository
        repository: {
          owner: 'iamplayerexe',
          name: 'animelist_app' 
        },
        authToken: process.env.GITHUB_TOKEN,
        prerelease: false,
        draft: false
      }
    }
  ]
};