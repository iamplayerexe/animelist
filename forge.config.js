require('dotenv').config(); // Keep if you use environment variables for tokens/passwords

const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
// const packageJson = require('./package.json'); // Use packageJson if needed for setupExe naming etc.

module.exports = {
  packagerConfig: {
    asar: true,
    icon: './src/assets/app-logo.ico', // Main app icon
    name: "AnimeList", // Use the desired product name for internal packaging

    // --- Updated Metadata ---
    executableName: 'AnimeList', // Name of the generated .exe
    appCopyright: `Copyright ©️ ${new Date().getFullYear()} Xutron`, // Copyright notice
    win32metadata: { // Windows specific properties
      CompanyName: 'Xutron',
      ProductName: 'AnimeList',
      FileDescription: 'Application to manage your anime list.',
      OriginalFilename: 'AnimeList.exe' // Should match executableName
    }
    // --- End Updated Metadata ---
  },

  rebuildConfig: {},

  makers: [
    {
      name: '@electron-forge/maker-squirrel', // For Windows installer
      config: {
        name: "AnimeList", // Name used by the installer
        // Optional: Customize installer icon
        setupIcon: './src/assets/app-logo.ico',
        // --- Code Signing (Recommended) ---
        // certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
        // certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,
      },
    },
    {
      name: '@electron-forge/maker-zip', // For macOS and Linux (alternative)
      platforms: ['darwin', 'linux'],
    },
    {
      name: '@electron-forge/maker-deb', // For Debian/Ubuntu Linux
      config: {
          options: {
              maintainer: 'Xutron',
              homepage: 'https://github.com/iamplayerexe/animelist', // Optional: Link to repo
              icon: './src/assets/app.png' // Icon for Linux package
          }
      },
    },
    {
      name: '@electron-forge/maker-rpm', // For Fedora/CentOS Linux
      config: {
          options: {
              maintainer: 'Xutron',
              homepage: 'https://github.com/iamplayerexe/animelist',
              icon: './src/assets/app.png'
          }
      },
    },
  ],

  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    new FusesPlugin({ // Security settings
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],

  // --- Updated Publishers Section ---
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'iamplayerexe', // CORRECTED
          name: 'animelist'     // CORRECTED
        },
        authToken: process.env.GITHUB_TOKEN, // Set GITHUB_TOKEN env var when publishing
        prerelease: false,
        draft: false
      }
    }
  ]
  // --- End Updated Publishers Section ---
};