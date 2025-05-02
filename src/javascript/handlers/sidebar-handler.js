// <-- comment (.js file)(src/javascript/handlers/sidebar-handler.js)
// src/javascript/handlers/sidebar-handler.js
const elements = require('../dom-elements');
const constants = require('../constants');
const state = require('../state');
const languageHandler = require('./language-handler');
const viewManager = require('../view-manager'); // Correct path

// --- Create Type Filter Dropdown ---
function createTypeFilterDropdown() {
    const container = elements.typeFilterDropdownContainer;
    if (!container) { console.error("Sidebar Error: Type filter dropdown container not found!"); return null; }
    container.innerHTML = '';
    const typeSelect = document.createElement('select');
    typeSelect.id = 'type-filter-select';
    typeSelect.title = languageHandler.translate('sidebarTypeTitle');
    const allOption = document.createElement('option'); allOption.value = 'All'; allOption.textContent = languageHandler.translate('filterAllTypes'); typeSelect.appendChild(allOption);
    // Use constants directly from require if not modified elsewhere
    const localConstants = require('../constants'); // Get fresh reference if needed
    localConstants.ALLOWED_SEASON_TYPES.forEach(type => { const option = document.createElement('option'); option.value = type; const translationKey = `seasonType${type.replace('-', '')}`; option.textContent = languageHandler.translate(translationKey, { fallback: type }); typeSelect.appendChild(option); });
    typeSelect.value = state.getCurrentTypeFilter(); // Set initial value from state

    typeSelect.addEventListener('change', (event) => {
        const selectedType = event.target.value;
        console.log(`Sidebar: Type filter changed to: ${selectedType}`); // LOG: Dropdown change
        if (selectedType !== state.getCurrentTypeFilter()) {
            state.setCurrentTypeFilter(selectedType);
            // Only reload cards if the current view is the card container
            if (state.getCurrentView() === 'cards-container') {
                const loadCardsFunc = state.getLoadCardsFunction?.();
                if (loadCardsFunc) {
                    console.log("Sidebar: Triggering loadCards due to type filter change."); // LOG: Trigger load
                    setTimeout(loadCardsFunc, 0);
                } else {
                    console.warn("Sidebar Warning: Cannot reload cards on type filter change: loadCards function not found in state.");
                }
            } else {
                 console.log("Sidebar: Type filter changed, but not in cards view. No card reload.");
            }
        }
    });
    container.appendChild(typeSelect);
    console.log("Sidebar: Type filter dropdown created/updated.");
    return typeSelect;
}

// --- Setup Sidebar ---
function setupSidebar() {
    // --- Toggle Button Setup ---
    elements.sidebarToggle?.addEventListener('click', () => {
        console.log("Sidebar: Toggle button clicked."); // LOG: Toggle click
        const isCollapsed = elements.appContainer?.classList.toggle('sidebar-collapsed');
        if (elements.sidebarToggleIcon) { elements.sidebarToggleIcon.src = isCollapsed ? constants.SIDEBAR_COLLAPSED_ICON : constants.SIDEBAR_EXPANDED_ICON; }
        // Hide/show dropdowns/selectors when collapsing/expanding
        if (elements.typeFilterDropdownContainer) { elements.typeFilterDropdownContainer.style.display = isCollapsed ? 'none' : 'block'; }
        const langSelector = document.getElementById('language-selector-container');
        if (langSelector) { langSelector.style.display = isCollapsed ? 'none' : 'block'; }
    });

    // --- Type Filter Dropdown Creation ---
    createTypeFilterDropdown(); // Create it initially

    // --- Status and Data Filter Button Setup ---
    if (!elements.allFilterButtons) {
         console.error("Sidebar Setup Error: elements.allFilterButtons is null or undefined.");
         return;
    }
    elements.allFilterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetViewId = button.dataset.viewTarget || 'cards-container';
            const newStatusFilter = button.dataset.statusFilter; // Might be undefined for 'Data' button
            const buttonText = button.querySelector('.text')?.textContent || button.id || 'Unknown Button';

            console.log(`Sidebar: Filter button clicked - Text: "${buttonText}", Status Filter: ${newStatusFilter}, Target View: ${targetViewId}`); // LOG: Button click details

            // Clear Auto-Add selections if navigating away from it
            const previousView = state.getCurrentView();
            if (previousView === 'auto-add-view' && targetViewId !== 'auto-add-view') {
                 console.log("Sidebar: Navigating away from auto-add, clearing selections.");
                 if (window.electronAPI?.clearAutoAddSelections) {
                     window.electronAPI.clearAutoAddSelections();
                 } else {
                      console.warn("Sidebar Warning: clearAutoAddSelections not found on window.electronAPI.");
                 }
             }

            // Update status filter state ONLY if it's defined for this button
            if (newStatusFilter && newStatusFilter !== state.getCurrentStatusFilter()) {
                 console.log(`Sidebar: Setting status filter state to: ${newStatusFilter}`);
                 state.setCurrentStatusFilter(newStatusFilter);
                 // If we set a status filter, ensure type filter is reset to 'All' unless it's already the cards view
                 // (This might be too aggressive, consider if you want combined filters later)
                 // if (state.getCurrentTypeFilter() !== 'All' && targetViewId === 'cards-container') {
                 //     console.log("Sidebar: Resetting type filter to 'All' due to status filter change.");
                 //     state.setCurrentTypeFilter('All');
                 //     const typeDropdown = document.getElementById('type-filter-select');
                 //     if (typeDropdown) typeDropdown.value = 'All';
                 // }
            } else if (newStatusFilter) {
                 console.log(`Sidebar: Status filter unchanged (${newStatusFilter}).`);
            }


            // Switch the view using the View Manager
            console.log(`Sidebar: Calling viewManager.switchView('${targetViewId}')`);
            viewManager.switchView(targetViewId);
        });
    });

    // --- Set Initial Collapsed State Visuals ---
    if (elements.appContainer && elements.sidebarToggleIcon) {
        const isInitiallyCollapsed = elements.appContainer.classList.contains('sidebar-collapsed');
        elements.sidebarToggleIcon.src = isInitiallyCollapsed ? constants.SIDEBAR_COLLAPSED_ICON : constants.SIDEBAR_EXPANDED_ICON;
         if (elements.typeFilterDropdownContainer) { elements.typeFilterDropdownContainer.style.display = isInitiallyCollapsed ? 'none' : 'block'; }
         const langSelector = document.getElementById('language-selector-container');
        if (langSelector) { langSelector.style.display = isInitiallyCollapsed ? 'none' : 'block'; }
    }
    console.log("Sidebar setup complete.");
}

module.exports = {
    setupSidebar,
    createTypeFilterDropdown // Export this so language handler can call it
};
// <-- end comment (.js file)(src/javascript/handlers/sidebar-handler.js)