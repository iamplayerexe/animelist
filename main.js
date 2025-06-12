const { app, BrowserWindow, ipcMain, screen, autoUpdater, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { initializeDataHandlers } = require('./src/main-process/anime-data-handler');

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

// --- Auto Update Setup ---
const owner = 'iamplayerexe';
const repo = 'animelist';
const repoUrl = `https://github.com/${owner}/${repo}`;

function initializeAutoUpdater() {
    const server = 'https://update.electronjs.org';
    const feed = `${server}/${owner}/${repo}/${process.platform}-${process.arch}/${app.getVersion()}`;
    try {
        console.log(`Setting autoUpdater feed URL to: ${feed}`);
        autoUpdater.setFeedURL({ url: feed });

        autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
            const versionInfo = releaseName ? `Version ${releaseName}` : 'A new version';
            const dialogOpts = {
                type: 'info', buttons: ['Restart Now', 'Later'], title: 'Application Update',
                message: versionInfo, detail: 'A new version has been downloaded. Restart the application to apply the updates.'
            };
            dialog.showMessageBox(mainWindow, dialogOpts).then(returnValue => {
                if (returnValue.response === 0) autoUpdater.quitAndInstall();
            });
        });
        autoUpdater.on('error', (error) => {
            dialog.showErrorBox('Update Error', `Failed to check for or install updates: ${error.message}`);
        });
    } catch (error) {
        dialog.showErrorBox('Updater Initialization Error', `Could not set up automatic updates: ${error.message}`);
    }
}

function checkForUpdatesLinux() {
    console.log('Checking for updates on Linux...');
    const options = {
        hostname: 'api.github.com', path: `/repos/${owner}/${repo}/releases/latest`,
        method: 'GET', headers: { 'User-Agent': 'AnimeList-App' }
    };
    https.get(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                if (res.statusCode !== 200) throw new Error(`GitHub API responded with status ${res.statusCode}`);
                const latestVersion = JSON.parse(data).tag_name.replace('v', '');
                if (latestVersion > app.getVersion()) {
                    dialog.showMessageBox({
                        type: 'info', buttons: ['Go to Downloads', 'Later'],
                        title: 'Update Available', message: `A new version (${latestVersion}) is available.`,
                        detail: 'Please visit the releases page to download the new version.'
                    }).then(res => { if (res.response === 0) shell.openExternal(`${repoUrl}/releases/latest`); });
                }
            } catch (e) { console.error('Error parsing Linux update check:', e); }
        });
    }).on('error', e => console.error('Error during Linux update request:', e));
}

function checkForUpdates() {
    if (!app.isPackaged) {
        console.log('Skipping update check in development.');
        return;
    }
    switch (process.platform) {
        case 'win32':
        case 'darwin':
            initializeAutoUpdater();
            autoUpdater.checkForUpdates();
            break;
        case 'linux':
            checkForUpdatesLinux();
            break;
    }
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
    mainWindow.webContents.once('did-finish-load', () => setTimeout(checkForUpdates, 5000));
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