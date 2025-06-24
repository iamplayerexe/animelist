// forge.config.js
require('dotenv').config();

const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

// --- START: Dynamic Maker Configuration ---
let makers = [];

if (process.platform === 'win32') {
  makers = [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: "AnimeList",
        setupIcon: './src/assets/app-logo.ico',
      },
    },
  ];
} else if (process.platform === 'darwin') {
  makers = [
    {
      name: '@electron-forge/maker-dmg',
      config: {
        icon: './src/assets/app-logo.icns',
        name: 'AnimeList'
      },
    },
  ];
} else if (process.platform === 'linux') {
  makers = [
    {
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
  ];
}
// --- END: Dynamic Maker Configuration ---


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

  // Use the dynamically determined makers array
  makers: makers,

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
          name: 'animelist_app'
        },
        authToken: process.env.GITHUB_TOKEN,
        prerelease: false,
        draft: false
      }
    }
  ]
};