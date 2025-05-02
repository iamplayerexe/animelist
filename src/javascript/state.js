// <-- comment (.js file)(src/javascript/state.js)
// src/javascript/state.js
let currentStatusFilter = 'All'; // Explicitly 'All'
let currentTypeFilter = 'All';   // Explicitly 'All'
let currentView = 'cards-container'; // Initial view
let currentLanguage = 'en';
let languageData = {};
let loadCardsRef = null;

module.exports = {
    // Status Filter state
    getCurrentStatusFilter: () => currentStatusFilter,
    setCurrentStatusFilter: (newFilter) => {
        console.log(`State: Status Filter changing from "${currentStatusFilter}" to "${newFilter}"`);
        currentStatusFilter = newFilter;
    },

    // Type Filter state
    getCurrentTypeFilter: () => currentTypeFilter,
    setCurrentTypeFilter: (newFilter) => {
        console.log(`State: Type Filter changing from "${currentTypeFilter}" to "${newFilter}"`);
        currentTypeFilter = newFilter;
    },

    // View state
    getCurrentView: () => currentView,
    setCurrentView: (newView) => {
        console.log(`State: View changing from "${currentView}" to "${newView}"`);
        currentView = newView;
    },

    // Language Preference state
    getCurrentLanguage: () => currentLanguage,
    setCurrentLanguage: (newLang) => {
        console.log(`State: Language changing from "${currentLanguage}" to "${newLang}"`);
        currentLanguage = newLang;
    },

    // Language Translation Data state
    getLanguageData: () => languageData,
    setLanguageData: (data) => {
        console.log(`State: Setting language translation data.`);
        languageData = data;
    },

    // Function reference state <-- Get/Set for loadCards function
    setLoadCardsFunction: (func) => {
        console.log("State: Setting loadCards function reference.");
        loadCardsRef = func;
    },
    getLoadCardsFunction: () => loadCardsRef,
};
// <-- end comment (.js file)(src/javascript/state.js)