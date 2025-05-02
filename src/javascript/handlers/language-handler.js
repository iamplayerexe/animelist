// <-- comment (.js file)(src/javascript/handlers/language-handler.js)
// src/javascript/handlers/language-handler.js
const { ipcRenderer } = require('electron');
const state = require('../state');

let loadCardsFunc = null;
let createTypeDropdownFunc = null;

// --- Translation Function (Case-Insensitive Lookup) ---
function translate(key, placeholders = {}) {
    const langData = state.getLanguageData();
    const currentLang = state.getCurrentLanguage();
    const lowerKey = key.toLowerCase();
    let translation = langData?.[currentLang]?.translations?.[lowerKey];
    if (translation === undefined || translation === null) {
        translation = langData?.['en']?.translations?.[lowerKey];
        if (translation === undefined || translation === null) {
             if (key.toLowerCase().startsWith('seasontype') && key.toLowerCase() !== 'seasontypeseason') {
                 console.warn(`Translation potentially missing for specific type key "${key}" (normalized: "${lowerKey}") in "${currentLang}" & "en". Using base type name.`);
                 let baseType = key.substring('seasonType'.length);
                 if (baseType.toLowerCase() === 'noncanon') baseType = 'Non-Canon';
                 translation = baseType;
             } else {
                 console.warn(`Translation missing for key "${key}" (normalized: "${lowerKey}") in language "${currentLang}" and fallback "en". Using original key.`);
                 translation = key;
             }
        }
    }
    let result = String(translation);
    try {
        for (const placeholder in placeholders) {
            const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\{${escapedPlaceholder}\\}`, 'g');
            result = result.replace(regex, placeholders[placeholder]);
        }
    } catch (error) {
        console.error(`Error replacing placeholders for key "${key}":`, error);
        result = String(translation);
    }
    return result;
}

// --- Update Static UI Elements ---
function updateUI() {
    console.log(`Updating UI elements for language: ${state.getCurrentLanguage()}`);
    document.querySelectorAll('[data-translate]').forEach(el => {
        el.textContent = translate(el.dataset.translate);
    });
    document.querySelectorAll('[data-translate-title]').forEach(el => {
        el.title = translate(el.dataset.translateTitle);
    });
    document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
        el.placeholder = translate(el.dataset.translatePlaceholder);
    });
    document.title = translate('appTitle');
    console.log("UI element update complete.");
}

// --- Helper for Fallback Emojis ---
function getFallbackEmoji(langCode) { /* ... (implementation unchanged) ... */
    const emojiMap = {
        'en': '🇺🇸', 'fr': '🇫🇷', 'ja': '🇯🇵', 'es': '🇪🇸', 'de': '🇩🇪',
        'it': '🇮🇹', 'pt': '🇵🇹', 'ru': '🇷🇺', 'zh': '🇨🇳', 'ko': '🇰🇷',
        'hi': '🇮🇳', 'ar': '🇸🇦', 'tr': '🇹🇷', 'pl': '🇵🇱', 'nl': '🇳🇱',
        'sv': '🇸🇪', 'no': '🇳🇴', 'da': '🇩🇰', 'fi': '🇫🇮', 'el': '🇬🇷'
    };
    return emojiMap[langCode] || '🌐';
}

// --- Create and Manage Custom Dropdown ---
function setupCustomLanguageSelector() {
    // *** Find container inside the function ***
    const container = document.getElementById('language-selector-container');
    if (!container) {
        // *** Log the specific error and stop ***
        console.error("SETUP ERROR: Language selector container (#language-selector-container) not found in the DOM.");
        return;
    }
    // *****************************************

    container.innerHTML = ''; // Clear previous content if any
    const langData = state.getLanguageData();
    const currentLang = state.getCurrentLanguage();

    if (!langData || typeof langData !== 'object' || Object.keys(langData).length === 0) {
        console.error("SETUP ERROR: Language data missing or invalid.");
        container.innerHTML = '<p style="color: red; padding: 10px;">Lang data error.</p>';
        return;
    }

    const selectorButton = document.createElement('button');
    selectorButton.className = 'language-selector-button';
    selectorButton.type = 'button';
    selectorButton.setAttribute('aria-haspopup', 'listbox');
    selectorButton.setAttribute('aria-expanded', 'false');
    selectorButton.id = 'language-selector-btn';

    const selectedFlagEmojiContainer = document.createElement('span');
    selectedFlagEmojiContainer.className = 'lang-flag-emoji-container';
    const selectedLangName = document.createElement('span');
    selectedLangName.className = 'lang-name';

    function updateButtonDisplay(langCode) {
        const info = langData[langCode];
        const emojiSpan = document.createElement('span');
        emojiSpan.className = 'lang-emoji';
        emojiSpan.textContent = getFallbackEmoji(langCode);
        selectedFlagEmojiContainer.innerHTML = '';
        selectedFlagEmojiContainer.appendChild(emojiSpan);
        selectedLangName.textContent = info?.name || langCode;
    }

    selectorButton.append(selectedFlagEmojiContainer, selectedLangName);
    container.appendChild(selectorButton);

    const optionsList = document.createElement('ul');
    optionsList.className = 'language-options-list';
    optionsList.setAttribute('role', 'listbox');
    optionsList.id = 'language-options';

    const availableLangs = Object.keys(langData).filter(key => key !== 'selectedLanguage');

    if (availableLangs.length === 0) {
         console.error("SETUP ERROR: No available languages found in normalized langData.");
         optionsList.innerHTML = '<li>No languages available</li>';
         selectorButton.disabled = true;
    } else {
        availableLangs.forEach(langCode => {
            const info = langData[langCode];
            if (!info || typeof info.translations !== 'object') {
                 console.warn(`Skipping invalid language data structure for code: ${langCode} after normalization.`);
                 return;
            }
            const optionItem = document.createElement('li');
            optionItem.className = 'language-option';
            optionItem.dataset.langCode = langCode;
            optionItem.setAttribute('role', 'option');
            optionItem.setAttribute('aria-selected', langCode === currentLang ? 'true' : 'false');
            optionItem.tabIndex = -1;

            const flagEmojiContainer = document.createElement('span'); flagEmojiContainer.className = 'lang-flag-emoji-container';
            const emojiSpan = document.createElement('span'); emojiSpan.className = 'lang-emoji'; emojiSpan.textContent = getFallbackEmoji(langCode); flagEmojiContainer.appendChild(emojiSpan);
            const nameSpan = document.createElement('span'); nameSpan.className = 'lang-name'; nameSpan.textContent = info?.name || langCode;
            optionItem.append(flagEmojiContainer, nameSpan);

            optionItem.addEventListener('click', async (event) => {
                event.stopPropagation();
                const newLang = optionItem.dataset.langCode;
                const previousLang = state.getCurrentLanguage();
                if (newLang !== previousLang) {
                    console.log(`Language selected via click: ${newLang}`);
                    state.setCurrentLanguage(newLang);
                    try { await ipcRenderer.invoke('saveLanguagePreference', newLang); } catch (error) { console.error("IPC Error saving language pref:", error); }
                    updateButtonDisplay(newLang); updateUI();
                    if (createTypeDropdownFunc) createTypeDropdownFunc(); else console.error("createTypeDropdownFunc not available!");
                    if (loadCardsFunc) setTimeout(() => loadCardsFunc(), 0); else console.warn("loadCardsFunc not available.");
                    optionsList.querySelectorAll('.language-option').forEach(opt => opt.setAttribute('aria-selected', opt.dataset.langCode === newLang ? 'true' : 'false'));
                }
                if (container.classList.contains('dropdown-open')) { container.classList.remove('dropdown-open'); selectorButton.setAttribute('aria-expanded', 'false'); }
            });
            optionsList.appendChild(optionItem);
        });
    }
    container.appendChild(optionsList);

    selectorButton.addEventListener('click', (event) => {
        event.stopPropagation(); const isCurrentlyOpen = container.classList.contains('dropdown-open'); container.classList.toggle('dropdown-open'); selectorButton.setAttribute('aria-expanded', !isCurrentlyOpen);
    });
    document.addEventListener('click', (event) => {
        if (container.classList.contains('dropdown-open') && !container.contains(event.target)) { container.classList.remove('dropdown-open'); selectorButton.setAttribute('aria-expanded', 'false'); }
    });

    updateButtonDisplay(currentLang);
    console.log(`Setup: Initial language selector button display set for "${currentLang}".`);
}


// --- Verify Keys Function ---
function verifyLanguageKeys(langData) { /* ... (implementation unchanged - still requires manual updates if keys change) ... */
     let allKeysPresent = true;
     if (!langData || typeof langData !== 'object') return false;
     const languages = Object.keys(langData).filter(key => key !== 'selectedLanguage');
     if (languages.length === 0) return false;
     const constants = require('../constants');
     if (!constants || !constants.STATUS_OPTIONS || !constants.ALLOWED_SEASON_TYPES) { console.error("VERIFY KEYS: Critical - Could not load constants."); return false; }
     const statusKeysToCheck = constants.STATUS_OPTIONS.map(statusValue => `filter${statusValue.replace(/\s+/g, '')}`);
     const typeKeysToCheck = constants.ALLOWED_SEASON_TYPES.map(type => `seasonType${type.replace('-', '')}`);
     const coreKeysToCheck = [ 'appTitle', 'navbarTitle', 'windowTitle', 'minimize', 'maximize', 'restore', 'close', 'toggleSidebar', 'sidebarStatusTitle', 'filterAll', 'sidebarManageTitle', 'sidebarDataButton', 'addButtonTitle', 'addButtonText', 'dataViewTitle', 'dataViewDescription', 'dataImportButton', 'dataExportButton', 'dataDangerZoneTitle', 'dataDangerZoneDescription', 'dataClearButton', 'footerCopyright', 'footerRights', 'cardStatusTitle', 'cardEpisodesLabel', 'cardMinusEpTitle', 'cardDetailsButtonText', 'cardDetailsButtonTitle', 'cardPlusEpTitle', 'loadingCardsMsg', 'noAnimeMsgBase', 'noAnimeMsgAddPrompt', 'noAnimeMsgFilter', 'noAnimeMsgStatusFilter', 'noAnimeMsgTypeFilter', 'noAnimeMsgCombinedFilter', 'errorLoadingCardsMsg', 'errorLoadingDataMsg', 'errorDataCorrupt', 'errorOccurred', 'operationSuccess', 'errorLoadingSeasonTypes', 'swalAddTitle', 'swalAddNamePlaceholder', 'swalAddEpisodesPlaceholder', 'swalAddImagePlaceholder', 'swalAddButton', 'swalCancelButton', 'swalValidationTitle', 'swalValidationEpisodes', 'toastAdding', 'toastAddedSuccess', 'toastAddedError', 'toastErrorUnexpected', 'swalDetailsOfficialTitle', 'swalDetailsUnknown', 'swalDetailsWatched', 'swalDetailsStatus', 'swalCloseButton', 'swalDeleteButton', 'swalDeleteConfirmTitle', 'swalDeleteConfirmHtml', 'swalDeleteConfirmButton', 'toastStatusUpdateSuccess', 'toastStatusUpdateError', 'toastEpisodeUpdateError', 'toastCommError', 'toastDeleteSuccess', 'toastDeleteError', 'toastErrorIPC', 'toastImportCancelled', 'swalImportModeTitle', 'swalImportModeHtml', 'swalImportModeOverwrite', 'swalImportModeMerge', 'swalImportModeValidation', 'swalImportModeNext', 'swalImportConfirmTitle', 'swalImportConfirmOverwrite', 'swalImportConfirmMerge', 'swalImportConfirmButtonOverwrite', 'swalImportConfirmButtonMerge', 'toastImporting', 'toastImportSuccess', 'toastImportError', 'swalImportErrorTitle', 'swalImportErrorTextDefault', 'swalImportErrorIPC', 'swalImportErrorIPCText', 'toastExportSuccess', 'toastExportError', 'toastExportCancelled', 'swalClearConfirmTitle', 'swalClearConfirmHtml', 'swalClearConfirmButton', 'toastClearing', 'toastClearSuccess', 'toastClearError', 'swalAddSeasonTypeLabel', 'swalAddSeasonNumberLabel', 'swalAddMovieNumberLabel', 'swalAddOAVNumberLabel', 'swalAddSpecialNumberLabel', 'swalAddScanNumberLabel', 'swalAddNonCanonNumberLabel', 'swalAddSeasonTypePlaceholder', 'swalAddSeasonNumberPlaceholder', 'swalValidationSeasonType', 'swalValidationSeasonNumber', 'swalDetailsType', 'swalDetailsNumber', 'swalDetailsNumberNA', 'sidebarTypeTitle', 'filterAllTypes', 'swalDetailsSeason', 'swalDetailsSeasonNA', 'swalDetailsWatchedSimple', 'swalDetailsTotalEpisodes', 'yes', 'no', 'cardMarkAsWatchedTitle', 'cardMarkAsUnwatchedTitle', 'addAnimeMethodTitle', 'addAnimeMethodText', 'addAnimeMethodAutomatic', 'addAnimeMethodManual', 'autoAddCancel', 'autoAddContinue', 'autoAddBack', 'autoAddConfirmEntry', 'autoAddSelectTitleHeading', 'autoAddSelectEntryHeading', 'autoAddLoadingTitles', 'autoAddLoadingEntries', 'autoAddNoEntries', 'autoAddSelectAnEntry', 'autoAddSelectAll', 'autoAddDeselectAll', 'addedNEntriesSuccess', 'addedNFailedMError'];
     const allLowerKeysToCheck = [...new Set([...coreKeysToCheck, ...statusKeysToCheck, ...typeKeysToCheck])].map(k => k.toLowerCase());
    languages.forEach(langCode => { const translations = langData[langCode]?.translations; if (!translations || typeof translations !== 'object') { console.error(`VERIFY KEYS: Missing or invalid 'translations' object for lang "${langCode}"!`); allKeysPresent = false; return; } allLowerKeysToCheck.forEach(lowerKey => { if (!Object.prototype.hasOwnProperty.call(translations, lowerKey) || translations[lowerKey] === undefined || translations[lowerKey] === null) { const originalKey = [...coreKeysToCheck, ...statusKeysToCheck, ...typeKeysToCheck].find(k => k.toLowerCase() === lowerKey) || lowerKey; console.error(`VERIFY KEYS: Missing key "${originalKey}" (normalized: ${lowerKey}) in lang "${langCode}"!`); allKeysPresent = false; } }); });
    if (!allKeysPresent) console.error("VERIFY KEYS: One or more essential keys missing (checked lowercase)."); else console.log("VERIFY KEYS: All checked essential keys appear present in normalized data."); return allKeysPresent;
}

// --- Initial Setup Function ---
async function setupLanguageSwitcher(_loadCards, _createTypeDropdown) {
    loadCardsFunc = _loadCards;
    createTypeDropdownFunc = _createTypeDropdown;
    const defaultLang = 'en';
    try {
        console.log("Language Setup: Fetching translations...");
        const response = await fetch('../languages.json');
        if (!response.ok) throw new Error(`HTTP ${response.status} loading languages.json`);
        const fetchedTranslations = await response.json();
        if (typeof fetchedTranslations !== 'object' || !fetchedTranslations?.[defaultLang]) throw new Error(`languages.json invalid or missing default '${defaultLang}' key.`);
        const normalizedLanguageData = {};
        for (const langCode in fetchedTranslations) { if (langCode === 'selectedLanguage') continue; const langEntry = fetchedTranslations[langCode]; if (langEntry && typeof langEntry === 'object') { normalizedLanguageData[langCode] = { name: langEntry.name || langCode, translations: {} }; if (langEntry.translations && typeof langEntry.translations === 'object') { for (const key in langEntry.translations) { if (Object.prototype.hasOwnProperty.call(langEntry.translations, key)) { const lowerKey = key.toLowerCase(); if (normalizedLanguageData[langCode].translations[lowerKey] !== undefined) console.warn(`Duplicate key ignored during normalization: "${key}" -> "${lowerKey}" in lang "${langCode}"`); normalizedLanguageData[langCode].translations[lowerKey] = langEntry.translations[key]; } } } else console.warn(`Missing or invalid 'translations' object for lang "${langCode}" during normalization.`); } else console.warn(`Skipping invalid language entry for code: ${langCode}`); }
        state.setLanguageData(normalizedLanguageData);
        console.log("Language Setup: Normalized translations loaded into state.");
        console.log("Language Setup: Fetching language preference...");
        let savedLang = defaultLang;
        try { savedLang = await ipcRenderer.invoke('getLanguagePreference'); if (!state.getLanguageData()[savedLang]) { console.warn(`Saved pref "${savedLang}" invalid/not found. Falling back to "${defaultLang}".`); savedLang = defaultLang; } } catch(ipcError) { console.error("IPC Error getting language pref:", ipcError); savedLang = defaultLang; }
        state.setCurrentLanguage(savedLang);
        console.log(`Language Setup: Initial language set to: ${state.getCurrentLanguage()}`);
        if (!verifyLanguageKeys(state.getLanguageData())) console.warn("Language Setup: Key verification failed. Check console."); else console.log("Language Setup: Key verification passed.");
        setupCustomLanguageSelector(); updateUI();
        console.log("Language Setup: Initial UI translation applied.");
    } catch (error) {
        console.error("CRITICAL ERROR during language setup:", error); state.setCurrentLanguage(defaultLang); state.setLanguageData({ [defaultLang]: { name: 'English (Fallback)', translations: { apptitle: 'Anime List (Error)' } } }); console.error("Language Setup: Using minimal fallback due to error."); try { updateUI(); const body = document.body; if (body) { const errorDiv = document.createElement('div'); errorDiv.textContent = `Lang Error: ${error.message}. Fallback active.`; errorDiv.style.cssText = 'color: red; position: fixed; top: 40px; left: 10px; z-index: 9999; background: black; padding: 5px; border: 1px solid red;'; body.appendChild(errorDiv); } } catch (uiError) { console.error("Error applying fallback UI:", uiError); }
    }
}

module.exports = { setupLanguageSwitcher, translate };
// <-- end comment (.js file)(src/javascript/handlers/language-handler.js)