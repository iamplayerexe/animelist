const { app, BrowserWindow, ipcMain, screen, autoUpdater, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { initializeDataHandlers } = require('./src/main-process/anime-data-handler');

// Window Size Constraints
const MIN_MAIN_AREA_WIDTH = 800;
const EXPANDED_SIDEBAR_WIDTH = 240;
const MIN_WINDOW_WIDTH = MIN_MAIN_AREA_WIDTH + EXPANDED_SIDEBAR_WIDTH;
const MIN_WINDOW_HEIGHT = 680;

let mainWindow;

// Handle Squirrel Startup Events (Required for Squirrel.Windows)
if (require('electron-squirrel-startup')) {
    app.quit();
}

// --- Auto Update Setup ---
const server = 'https://update.electronjs.org';
const owner = 'iamplayerexe'; // CORRECTED
const repo = 'animelist';     // CORRECTED
const feed = `${server}/${owner}/${repo}/${process.platform}-${process.arch}/${app.getVersion()}`;

// Auto-updates only work reliably in the packaged application.
if (app.isPackaged) {
  try {
    console.log(`Setting autoUpdater feed URL to: ${feed}`);
    autoUpdater.setFeedURL({ url: feed });

    // --- Event Listeners for Auto Updater ---
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for update...');
      // Optional: Send message to renderer if UI feedback is desired
      // mainWindow?.webContents.send('update-message', 'Checking for updates...');
    });

    autoUpdater.on('update-available', () => {
      console.log('Update available. Downloading...');
      // Optional: Send message to renderer
      // mainWindow?.webContents.send('update-message', 'Update available, downloading...');
    });

    autoUpdater.on('update-not-available', () => {
      console.log('Update not available.');
      // Optional: Send message to renderer
      // mainWindow?.webContents.send('update-message', 'You are running the latest version.');
    });

    autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
      const versionInfo = releaseName ? `Version ${releaseName}` : 'A new version';
      console.log(`Update downloaded: ${versionInfo}`);
      // Optional: Send message to renderer
      // mainWindow?.webContents.send('update-message', `${versionInfo} downloaded. Restart to install.`);

      const dialogOpts = {
        type: 'info',
        buttons: ['Restart Now', 'Later'],
        title: 'Application Update',
        message: versionInfo,
        detail: 'A new version has been downloaded. Restart the application to apply the updates.'
      };

      // Ensure dialog is shown on the main window if it exists
      const windowToShowOn = mainWindow || BrowserWindow.getFocusedWindow();

      dialog.showMessageBox(windowToShowOn, dialogOpts).then((returnValue) => {
        if (returnValue.response === 0) { // 'Restart Now'
           console.log('User chose to restart. Quitting and installing update...');
           autoUpdater.quitAndInstall();
        } else {
           console.log('User chose to install the update later.');
        }
      }).catch(err => {
          console.error('Error showing update downloaded dialog:', err);
      });
    });

    autoUpdater.on('error', (error) => {
      console.error('There was a problem updating the application:');
      console.error(error);
      // Optional: Send message to renderer
      // mainWindow?.webContents.send('update-message', `Update Error: ${error.message}`);
      dialog.showErrorBox('Update Error', `Failed to check for or install updates: ${error.message}\n\nPlease check your connection or try again later. Logs may contain more details.`);
    });

  } catch (error) {
      console.error('Failed to initialize auto-updater:', error);
      dialog.showErrorBox('Updater Initialization Error', `Could not set up automatic updates: ${error.message}`);
  }
} else {
    console.log('Skipping auto-update checks in development mode.');
}

// Function to manually trigger the update check.
function checkForUpdates() {
    if (app.isPackaged) {
        console.log('Triggering update check...');
        try {
            autoUpdater.checkForUpdates();
        } catch (error) {
            console.error('Error when calling checkForUpdates():', error);
             dialog.showErrorBox('Update Check Failed', `Could not start the update check: ${error.message}`);
        }
    } else {
        console.log('Skipping update check trigger in development.');
    }
}
// --- End Auto Update Setup ---


// --- App Lifecycle ---
app.whenReady().then(() => {
    console.log("Main Process: App ready.");
    mainWindow = new BrowserWindow({
        minWidth: MIN_WINDOW_WIDTH,
        minHeight: MIN_WINDOW_HEIGHT,
        icon: path.join(__dirname, "src", "assets", "app-logo.ico"),
        width: 1200,
        height: 800,
        titlebarStyle: 'hidden',
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    initializeDataHandlers(mainWindow);

    const htmlPath = path.join(__dirname, 'src', 'index.html');
    console.log('Loading HTML FROM:', htmlPath);
    if (!fs.existsSync(htmlPath)) {
        console.error('!!!!!!!!!!!!!!!!!! HTML FILE DOES NOT EXIST AT PATH !!!!!!!!!!!!!!!!!!!');
        dialog.showErrorBox('Fatal Error', `Cannot load required file: ${htmlPath}`);
        app.quit();
        return;
    }

    mainWindow.loadFile(htmlPath);

    // --- Trigger Update Check After Window Loads ---
    mainWindow.webContents.once('did-finish-load', () => {
        console.log('Window finished loading. Scheduling update check.');
        setTimeout(checkForUpdates, 5000); // 5-second delay
    });
    // --- End Trigger Update Check ---

});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && app.isReady()) {
         console.log("Recreating main window on activate.");
         mainWindow = new BrowserWindow({
             minWidth: MIN_WINDOW_WIDTH, minHeight: MIN_WINDOW_HEIGHT,
             icon: path.join(__dirname, "src", "assets", "app-logo.ico"),
             width: 1200, height: 800, titlebarStyle: 'hidden', frame: false,
             webPreferences: { nodeIntegration: true, contextIsolation: false, },
         });
         initializeDataHandlers(mainWindow);
         const htmlPath = path.join(__dirname, 'src', 'index.html');
         console.log('Loading HTML FROM (Activate):', htmlPath);
         mainWindow.loadFile(htmlPath);
         mainWindow.webContents.once('did-finish-load', () => {
             console.log('Recreated window finished loading. Scheduling update check.');
             setTimeout(checkForUpdates, 5000);
         });
    } else if (mainWindow) {
         if (mainWindow.isMinimized()) mainWindow.restore();
         mainWindow.focus();
    }
});


// --- Basic Window Controls ---
ipcMain.handle('closeApp', () => mainWindow?.close());
ipcMain.handle('minimizeApp', () => mainWindow?.minimize());
ipcMain.handle('maximizeApp', () => {
    if (mainWindow?.isMaximizable()) {
        mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    }
});
// --- End App Lifecycle & Window Controls ---