// <-- comment (.js file)(renderer.js)
// renderer.js (Root - Corrected Paths relative to src/index.html)

const { ipcRenderer } = require('electron'); // Required for IPC calls

// Paths must be relative to the HTML file (src/index.html) because of nodeIntegration:true
const elements = require('./javascript/dom-elements'); // Uses simplified version
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

// --- Function to update title bar with version --- ADDED ---
async function updateWindowTitleWithVersion() {
    // Find the specific span using its ID
    const titleSpan = document.getElementById('window-title-text');
    if (!titleSpan) {
        console.error('Renderer: Could not find title span element (#window-title-text) to update.');
        return;
    }
    // Get the base title text from the translation system if possible
    const baseTitle = utils.translate('windowTitle', { fallback: 'Anime List' });
    try {
        console.log("Renderer: Requesting app version via IPC...");
        // Call the handler in the main process
        const appVersion = await ipcRenderer.invoke('get-app-version');
        console.log(`Renderer: Received app version: ${appVersion}`);
        if (appVersion) {
             // Construct the new title string and update the element
            titleSpan.textContent = `${baseTitle} v${appVersion}`;
        } else {
            // Fallback if version is missing, keep base title
            titleSpan.textContent = baseTitle;
        }
    } catch (error) {
        // Log any error during IPC and keep base title
        console.error('Renderer: Failed to get app version via IPC:', error);
        titleSpan.textContent = baseTitle; // Ensure title is at least the base on error
    }
}
// --- End Added Function ---

window.addEventListener('DOMContentLoaded', async () => {
    console.log("DOMContentLoaded: Setting up application...");

    try {
        globalLoadCards = loadCards;
        state.setLoadCardsFunction?.(globalLoadCards);

        // Setup language first, as other parts might depend on translations
        await setupLanguageSwitcher(globalLoadCards, createTypeFilterDropdown);
        console.log("Setup: Language switcher done.");

        // --- CALL FUNCTION TO UPDATE TITLE ---
        updateWindowTitleWithVersion(); // Update title right after language setup
        console.log("Setup: Window title update initiated.");
        // --- END CALL ---

        // Set copyright year
        const copyrightYearSpan = document.getElementById('copyright-year');
        if (copyrightYearSpan) { copyrightYearSpan.textContent = new Date().getFullYear(); console.log("Setup: Copyright year set."); }
        else { console.error("SETUP ERROR: Could not find #copyright-year span in footer!"); }

        // Setup other components
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
        viewManager.switchView('cards-container'); // This should load cards if logic inside is correct
        console.log("Setup: Initial view switch call completed.");

        console.log("Setup: Handling loading screen...");
        handleLoadingScreen(); // Hide loading screen last
        console.log("Setup: Initial setup complete.");

    } catch (error) {
         console.error("Error during initial setup:", error);
         const body = document.body;
         const loadingScreenElement = document.getElementById('loading-screen');
         // Display error prominently if possible
         if (body && loadingScreenElement) { loadingScreenElement.innerHTML = `<div style="color: red; padding: 20px; text-align: center;">Init Error: ${error.message}<br>Restart app or check logs.</div>`; loadingScreenElement.classList.remove('hidden'); }
         else if (body) { body.innerHTML = `<div style="color: red; padding: 20px;">Critical Init Error: ${error.message}</div>`; }
    }
});

// Expose limited functionality if needed by other parts (e.g., testing, complex interactions)
window.electronAPI = {
     getLoadCardsFunction: () => globalLoadCards,
     clearAutoAddSelections: () => { clearSelections?.(); }
};
// <-- end comment (.js file)(renderer.js)
// <-- end comment (.js file)(renderer.js)