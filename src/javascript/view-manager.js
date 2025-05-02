// <-- comment (.js file)(src/javascript/view-manager.js)
// src/javascript/view-manager.js
const elements = require('./dom-elements');
const state = require('./state');

let loadCardsFuncRef = null;
let activateAutoAddFuncRef = null;

// --- Update Sidebar Button Active States (REVISED LOGIC) ---
function updateButtonActiveStates() {
    const currentView = state.getCurrentView();
    const currentStatusFilter = state.getCurrentStatusFilter();
    const sidebarButtons = elements.allFilterButtons; // Status + Data buttons

    console.log(`ViewManager: Updating button states. Current View: ${currentView}, Status Filter: ${currentStatusFilter}`);

    if (!sidebarButtons) {
        console.warn("ViewManager: Cannot update button states, sidebar buttons not found.");
        return;
    }

    sidebarButtons.forEach(btn => {
        const btnTargetView = btn.dataset.viewTarget || 'cards-container';
        const btnStatusFilter = btn.dataset.statusFilter; // Defined for status buttons, undefined for Data button
        let shouldBeActive = false;

        // Determine if the button *should* be active based on current state
        if (currentView === 'cards-container') {
            // If in cards view, ONLY a status button matching the current filter should be active
            if (btnStatusFilter && btnStatusFilter === currentStatusFilter) {
                shouldBeActive = true;
            }
            // The 'Data' button (where btnStatusFilter is undefined) should NOT be active here
        } else if (currentView === 'data-management-view') {
            // If in data view, ONLY the data button (target='data-management-view', no status filter) should be active
            if (btnTargetView === 'data-management-view' && !btnStatusFilter) {
                shouldBeActive = true;
            }
        } else if (currentView === 'auto-add-view') {
            // No sidebar buttons active in auto-add view
            shouldBeActive = false;
        }
        // Add conditions for other views if necessary

        // Apply/Remove the class based on comparison
        const isActiveNow = btn.classList.contains('active');
        const buttonText = btn.querySelector('.text')?.textContent || btn.id || 'Unknown Button';

        if (isActiveNow && !shouldBeActive) {
            console.log(`ViewManager: Deactivating button "${buttonText}"`);
            btn.classList.remove('active');
        } else if (!isActiveNow && shouldBeActive) {
            console.log(`ViewManager: Activating button "${buttonText}"`);
            btn.classList.add('active');
        }
    });

    // Sync Type dropdown (remains the same)
    const typeDropdown = document.getElementById('type-filter-select');
    if (typeDropdown && typeDropdown.value !== state.getCurrentTypeFilter()) {
        console.log(`ViewManager: Syncing type dropdown to state value: ${state.getCurrentTypeFilter()}`);
        typeDropdown.value = state.getCurrentTypeFilter();
    }
}


// --- View Switching Logic (Handle same-view refresh) ---
function switchView(targetViewId) {
    const previousView = state.getCurrentView();
    const targetEl = document.getElementById(targetViewId);
    const autoAddControlsBar = document.getElementById('auto-add-controls-bar');
    const cardsContainerEl = document.getElementById('cards-container');
    // --- Get reference to footer ---
    const footerEl = document.querySelector('footer');


    // Get filter state *before* potentially changing view state
    const statusFilterForActivationCheck = state.getCurrentStatusFilter();
    const typeFilterForActivationCheck = state.getCurrentTypeFilter();


    const isChangingView = previousView !== targetViewId;
    console.log(`ViewManager: Request to switch from "${previousView}" to "${targetViewId}"`);

    if (!targetEl) { console.error(`ViewManager: Target element with ID "${targetViewId}" not found.`); return; }
    if (!autoAddControlsBar) console.error(`ViewManager: Auto-add controls bar missing!`);
    if (!cardsContainerEl) console.warn(`ViewManager: Cards container element not found! Cannot manage its top margin.`);
    // --- Check for footer element ---
    if (!footerEl) console.warn(`ViewManager: Footer element not found! Cannot manage its top margin.`);


    // --- START: Manage Cards Container .has-top-margin Class ---
    if (cardsContainerEl) { // Only proceed if the element exists
        if (targetViewId === 'cards-container') {
            // Add the margin class when switching TO the cards view
            if (!cardsContainerEl.classList.contains('has-top-margin')) {
                console.log("ViewManager: Adding .has-top-margin to cards container");
                cardsContainerEl.classList.add('has-top-margin');
            }
        } else {
            // Remove the margin class when switching AWAY from the cards view
            if (cardsContainerEl.classList.contains('has-top-margin')) {
                console.log("ViewManager: Removing .has-top-margin from cards container");
                cardsContainerEl.classList.remove('has-top-margin');
            }
        }
    }
    // --- END: Manage Cards Container .has-top-margin Class ---

    // --- START: Manage Footer .footer-with-top-margin Class ---
    if (footerEl) { // Only proceed if footer exists
        if (targetViewId === 'cards-container') {
            // Add the margin class when switching TO the cards view
            if (!footerEl.classList.contains('footer-with-top-margin')) {
                console.log("ViewManager: Adding .footer-with-top-margin to footer");
                footerEl.classList.add('footer-with-top-margin');
            }
        } else {
            // Remove the margin class when switching AWAY from the cards view
            if (footerEl.classList.contains('footer-with-top-margin')) {
                console.log("ViewManager: Removing .footer-with-top-margin from footer");
                footerEl.classList.remove('footer-with-top-margin');
            }
        }
    }
    // --- END: Manage Footer .footer-with-top-margin Class ---


    if (isChangingView) {
        console.log(`ViewManager: Performing view switch DOM changes.`);
        document.querySelectorAll('.view-container').forEach(container => {
            container.style.display = 'none';
            container.classList.remove('active-view');
            if (container.id === 'auto-add-view' && targetViewId !== 'auto-add-view') {
                 const autoAddCardsContainer = container.querySelector('#auto-add-cards-container');
                 if(autoAddCardsContainer) autoAddCardsContainer.innerHTML = '';
            }
        });
        if(autoAddControlsBar) { autoAddControlsBar.style.display = (targetViewId === 'auto-add-view') ? 'flex' : 'none'; }
        let displayType = 'block';
        if (targetViewId === 'cards-container') { displayType = 'grid'; }
        else if (targetViewId === 'auto-add-view') { displayType = 'flex'; }
        targetEl.style.display = displayType;
        targetEl.classList.add('active-view');

        state.setCurrentView(targetViewId); // Update state AFTER DOM changes for this view
    } else {
        console.log(`ViewManager: Target view "${targetViewId}" is same as current. Skipping DOM switch.`);
    }

    // Always update button highlights AFTER potential state change
    updateButtonActiveStates();

    // Determine if activation (like loading cards) is needed
    let needsActivation = isChangingView;

    if (targetViewId === 'cards-container') {
         console.log("ViewManager: Target is cards-container, setting needsActivation=true to ensure card reload/display.");
         needsActivation = true;
    }

    if (needsActivation) {
        requestAnimationFrame(() => {
            console.log(`ViewManager: Requesting activation for view "${targetViewId}" (Needs Activation: ${needsActivation})`);
            if (targetViewId === 'cards-container' && loadCardsFuncRef) {
                console.log("ViewManager: -> Calling loadCardsFuncRef()");
                loadCardsFuncRef(); // This will use the *latest* filter state
            } else if (targetViewId === 'auto-add-view' && activateAutoAddFuncRef) {
                console.log(`ViewManager: -> Calling activateAutoAddFuncRef('${targetViewId}')`);
                activateAutoAddFuncRef(targetViewId);
            } else if (targetViewId === 'data-management-view') {
                 console.log("ViewManager: -> No specific activation needed for data view.");
            } else {
                 console.warn(`ViewManager: No activation function configured for target view "${targetViewId}"`);
            }
        });
    } else {
         console.log(`ViewManager: Activation not needed for view "${targetViewId}".`);
    }
}

// Initialization function
function initializeViewManager(loadCardsFunc, activateAutoAddFunc) {
    console.log("ViewManager: Initializing...");
    loadCardsFuncRef = loadCardsFunc;
    activateAutoAddFuncRef = activateAutoAddFunc;
    const autoAddView = document.getElementById('auto-add-view');
    if (autoAddView) autoAddView.style.display = 'none'; else console.error("ViewManager Init Error: #auto-add-view not found!");
    const autoAddControlsBar = document.getElementById('auto-add-controls-bar');
     if (autoAddControlsBar) autoAddControlsBar.style.display = 'none'; else console.error("ViewManager Init Error: #auto-add-controls-bar not found!");

     // --- Add initial margin classes if starting on cards view ---
     const initialView = state.getCurrentView();
     const cardsContainerEl = document.getElementById('cards-container');
     const footerEl = document.querySelector('footer'); // Get footer reference

     if (initialView === 'cards-container') {
         if (cardsContainerEl) {
            console.log("ViewManager Init: Initial view is cards, adding .has-top-margin to cards container");
            cardsContainerEl.classList.add('has-top-margin');
         }
         if (footerEl) { // Check if footer exists
            console.log("ViewManager Init: Initial view is cards, adding .footer-with-top-margin to footer");
            footerEl.classList.add('footer-with-top-margin');
         }
     }
     // --- End initial margin classes ---

    console.log("ViewManager: Performing initial button state update.");
    updateButtonActiveStates();
}

module.exports = {
    initializeViewManager,
    switchView,
    updateButtonActiveStates
};
// <-- end comment (.js file)(src/javascript/view-manager.js)