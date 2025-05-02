// <-- comment (.js file)(src/javascript/dom-elements.js)
// src/javascript/dom-elements.js
// Keep only general, stable elements. Specific view elements are found locally.
module.exports = {
    loadingScreen: document.getElementById('loading-screen'),
    addButton: document.getElementById('selectFile'), // Main add button
    cardsContainer: document.getElementById('cards-container'), // Main anime card view
    allFilterButtons: document.querySelectorAll('#sidebar .filter-button'), // Sidebar status/data buttons
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    appContainer: document.getElementById('app-container'),
    sidebarToggleIcon: document.querySelector('#sidebar-toggle .sidebar-toggle-icon'),
    dataMgmtView: document.getElementById('data-management-view'), // Data management view container
    importButton: document.getElementById('import-button'), // Button within data view
    exportButton: document.getElementById('export-button'), // Button within data view
    clearDataButton: document.getElementById('clear-data-button'), // Button within data view
    allViewContainers: document.querySelectorAll('.view-container'), // All top-level view divs
    // Window control buttons
    closeButton: document.getElementById("close-button"),
    minButton: document.getElementById("min-button"),
    maxButton: document.getElementById("max-button"),
    restoreButton: document.getElementById("restore-button"),
    // Navbar text target for loading animation
    navbarNeonText: document.querySelector('.navbar-center .neon-text'),
    // Container for the type filter dropdown (still needed by sidebar handler)
    typeFilterDropdownContainer: document.getElementById('type-filter-dropdown-container'),

    // REMOVED: languageSelectorContainer (handled in language-handler.js)
    // REMOVED: copyrightYear (handled in renderer.js)
    // REMOVED: auto-add specific elements (handled in auto-add-handler.js)
};
// <-- end comment (.js file)(src/javascript/dom-elements.js)