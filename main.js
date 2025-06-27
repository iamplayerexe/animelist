// main.js
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { initializeDataHandlers } = require('./src/main-process/anime-data-handler');

// --- THIS IS THE FIX: Development Mode Toggle ---
// Set to 'true' when running with `npm start` to bypass the launcher check.
// Set to 'false' before creating a production build.
const IN_DEVELOPMENT_MODE = true;

// This argument will be passed by the launcher when it starts the app.
const LAUNCHER_ARG = '--launched-by-xutron';
const LAUNCHER_PROTOCOL_URI = 'xutron-launcher://relaunch?appId=animelist';

// Check if the app was launched directly in production
// MODIFIED: This condition now uses the new boolean toggle.
if (!IN_DEVELOPMENT_MODE && !process.argv.includes(LAUNCHER_ARG)) {
    // If not launched by the launcher, try to open the launcher via its protocol and quit.
    console.log('Not launched by XutronCore Launcher. Attempting to open launcher...');
    try {
        shell.openExternal(LAUNCHER_PROTOCOL_URI);
    } catch (e) {
        dialog.showErrorBox(
            'Launcher Required',
            'Could not start the XutronCore Launcher. Please ensure it is installed correctly and try again.'
        );
    }
    app.quit();
} else {
    // --- ALL ORIGINAL APP INITIALIZATION CODE IS PLACED INSIDE THIS ELSE BLOCK ---
    // --- (Update logic has been removed) ---

    // Window Size Constraints
    const MIN_MAIN_AREA_WIDTH = 800;
    const EXPANDED_SIDEBAR_WIDTH = 240;
    const MIN_WINDOW_WIDTH = MIN_MAIN_AREA_WIDTH + EXPANDED_SIDEBAR_WIDTH;
    const MIN_WINDOW_HEIGHT = 680;

    let mainWindow;

    // Handle Squirrel Startup Events
    if (require('electron-squirrel-startup')) {
        app.quit();
    }

    // --- App Lifecycle ---
    app.whenReady().then(() => {
        mainWindow = new BrowserWindow({
            minWidth: MIN_WINDOW_WIDTH, minHeight: MIN_WINDOW_HEIGHT,
            icon: path.join(__dirname, "src", "assets", "app-logo.ico"),
            width: 1200, height: 800, titlebarStyle: 'hidden', frame: false,
            webPreferences: { nodeIntegration: true, contextIsolation: false },
        });

        initializeDataHandlers(mainWindow);
        mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
        // The auto-update check has been removed from here.
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            // Re-create window logic can be added here if needed for macOS
        }
    });

    // --- Window Controls ---
    ipcMain.handle('closeApp', () => mainWindow?.close());
    ipcMain.handle('minimizeApp', () => mainWindow?.minimize());
    ipcMain.handle('maximizeApp', () => {
        if (mainWindow?.isMaximizable()) {
            mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
        }
    });
}