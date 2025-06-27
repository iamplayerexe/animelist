// renderer.js
const { ipcRenderer } = require('electron');

const elements = require('./javascript/dom-elements');
const state = require('./javascript/state');
const constants = require('./javascript/constants');
const utils = require('./javascript/utils');
const viewManager = require('./javascript/view-manager');
const { setupWindowControls } = require('./javascript/window-controls');
const { loadCards } = require('./javascript/handlers/anime-card-handler');
const { setupDialogs } = require('./javascript/swal-dialogs');
const { setupSidebar, createTypeFilterDropdown } = require('./javascript/handlers/sidebar-handler');
const { handleLoadingScreen } = require('./javascript/handlers/loading-screen-handler');
const { setupLanguageSwitcher } = require('./javascript/handlers/language-handler');
const { setupAutoAddView, activateAutoAddView, clearSelections } = require('./javascript/handlers/auto-add-handler');

let globalLoadCards = null;

async function updateWindowTitleWithVersion() {
    const titleSpan = document.getElementById('window-title-text');
    if (!titleSpan) {
        console.error('Renderer: Could not find title span element (#window-title-text) to update.');
        return;
    }
    const baseTitle = utils.translate('windowTitle', { fallback: 'Anime List' });
    try {
        console.log("Renderer: Requesting app version via IPC...");
        const appVersion = await ipcRenderer.invoke('get-app-version');
        console.log(`Renderer: Received app version: ${appVersion}`);
        if (appVersion) {
            titleSpan.textContent = `v${appVersion}`;
        } else {
            titleSpan.textContent = baseTitle;
        }
    } catch (error) {
        console.error('Renderer: Failed to get app version via IPC:', error);
        titleSpan.textContent = baseTitle;
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    console.log("DOMContentLoaded: Setting up application...");

    try {
        globalLoadCards = loadCards;
        state.setLoadCardsFunction?.(globalLoadCards);

        // --- THIS IS THE FIX: The initial theme application is removed from here. ---
        // The inline script in index.html now handles this.
        const themeToggle = document.getElementById('theme-toggle');
        const applyTheme = (theme) => {
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        };

        // The event listener for the button remains to allow user toggling.
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
        });
        // --- End of Fix ---

        await setupLanguageSwitcher(globalLoadCards, createTypeFilterDropdown);
        console.log("Setup: Language switcher done.");
        
        updateWindowTitleWithVersion();
        console.log("Setup: Window title update initiated.");

        const copyrightYearSpan = document.getElementById('copyright-year');
        if (copyrightYearSpan) { copyrightYearSpan.textContent = new Date().getFullYear(); console.log("Setup: Copyright year set."); }
        else { console.error("SETUP ERROR: Could not find #copyright-year span in footer!"); }

        setupWindowControls();
        console.log("Setup: Window controls done.");

        if (typeof globalLoadCards !== 'function') { console.error("CRITICAL: loadCards func unavailable!"); return; }

        viewManager.initializeViewManager(globalLoadCards, activateAutoAddView);
        console.log("Setup: View Manager initialized.");

        setupSidebar();
        console.log("Setup: Sidebar done.");

        setupDialogs(globalLoadCards);
        console.log("Setup: Dialogs done.");

        if (!document.getElementById('auto-add-view')) { console.error("Renderer Check: Auto-add view container (#auto-add-view) MISSING!"); }
        else { console.log("Renderer Check: Auto-add view container present."); setupAutoAddView(); console.log("Setup: Auto Add View done."); }

        console.log("Setup: Attempting to switch to initial view 'cards-container'...");
        viewManager.switchView('cards-container');

        console.log("Setup: Handling loading screen...");
        handleLoadingScreen();
        console.log("Setup: Initial setup complete.");

    } catch (error) {
         console.error("Error during initial setup:", error);
         const body = document.body;
         const loadingScreenElement = document.getElementById('loading-screen');
         if (body && loadingScreenElement) { loadingScreenElement.innerHTML = `<div style="color: red; padding: 20px; text-align: center;">Init Error: ${error.message}<br>Restart app or check logs.</div>`; loadingScreenElement.classList.remove('hidden'); }
         else if (body) { body.innerHTML = `<div style="color: red; padding: 20px;">Critical Init Error: ${error.message}</div>`; }
    }
});

window.electronAPI = {
     getLoadCardsFunction: () => globalLoadCards,
     clearAutoAddSelections: () => { clearSelections?.(); }
};