const { ipcRenderer } = require('electron');
const elements = require('../dom-elements');
const state = require('../state');
const { translate, Toast } = require('../utils');
const viewManager = require('../view-manager');
const constants = require('../constants');

let predefinedAnimeData = null;
let currentDisplayTitle = null;
let globallySelectedEntries = [];
let isLoadingData = false;

let autoAddViewEl = null;
let cardsContainerEl = null;
let controlsBarEl = null;
let backButtonEl = null;
let cancelButtonEl = null;
let confirmButtonEl = null;

async function loadPredefinedData() {
    if (predefinedAnimeData !== null && !isLoadingData) { return predefinedAnimeData; }
    if (isLoadingData) {
        console.log("AutoAdd: Waiting for existing data load...");
        await new Promise(resolve => {
             const interval = setInterval(() => { if (!isLoadingData) { clearInterval(interval); resolve(); }}, 100);
        });
        return predefinedAnimeData;
    }
    isLoadingData = true;
    console.log("AutoAdd: Fetching predefined anime data...");
    try {
        const response = await fetch('./data/animes.json');
        if (!response.ok) throw new Error(`HTTP error ${response.status} loading ./data/animes.json`);
        const data = await response.json();
        if (!data || typeof data.animes !== 'object') throw new Error("Invalid format in animes.json");
        predefinedAnimeData = data.animes;
        console.log(`AutoAdd: Loaded ${Object.keys(predefinedAnimeData).length} predefined titles.`);
        return predefinedAnimeData;
    } catch (error) {
        console.error("AutoAdd: Failed to load or parse predefined data:", error);
        Toast.fire({ icon: 'error', title: `Error loading predefined data: ${error.message}` });
        predefinedAnimeData = {};
        return {};
    } finally {
        isLoadingData = false;
    }
}

function getTitleSelectionStatus(title) {
    if (!predefinedAnimeData || !predefinedAnimeData[title]) return 'no-selection';
    let totalEntries = 0; let selectedCount = 0;
    const entriesData = predefinedAnimeData[title];
    constants.ALLOWED_SEASON_TYPES.forEach(type => {
        if (entriesData[type] && Array.isArray(entriesData[type])) {
            totalEntries += entriesData[type].length;
            entriesData[type].forEach(entry => {
                const uniqueId = `${title}__${type}__${entry.number ?? 'N'}`;
                if (globallySelectedEntries.some(sel => sel.uniqueId === uniqueId)) selectedCount++;
            });
        }
    });
    if (totalEntries === 0) return 'no-selection';
    if (selectedCount === 0) return 'no-selection';
    if (selectedCount === totalEntries) return 'all-selection';
    return 'partial-selection';
}

function updateSelectAllCardState(cardEl, selectedCount, totalCount) {
    if (!cardEl) return;
    if (totalCount === 0) { cardEl.style.display = 'none'; return; }
    cardEl.style.display = 'block';
    const isAll = selectedCount === totalCount;
    cardEl.classList.toggle('selected', isAll);
    cardEl.textContent = translate(isAll ? 'autoAddDeselectAll' : 'autoAddSelectAll');
}

function updateControlsBar() {
     if (!controlsBarEl || !backButtonEl || !cancelButtonEl || !confirmButtonEl) {
        console.error("AutoAdd Error: Core control bar button elements missing during updateControlsBar call! Check setup.");
        return;
    }
    const countSpan = confirmButtonEl.querySelector('#auto-add-selection-count');
    if (!countSpan) {
        console.error("AutoAdd Error: #auto-add-selection-count span MISSING inside confirm button during update!");
    }
    const inEntryStep = !!currentDisplayTitle;
    backButtonEl.style.display = inEntryStep ? 'inline-block' : 'none';
    cancelButtonEl.style.display = inEntryStep ? 'none' : 'inline-block';
    const hasSelection = globallySelectedEntries.length > 0;
    confirmButtonEl.disabled = !hasSelection;
    if (countSpan) {
        countSpan.textContent = `(${globallySelectedEntries.length})`;
    }
}

async function renderAutoAddView(step = 'title') {
    console.log(`AutoAdd: Rendering view - Step: ${step}, Current Title: ${currentDisplayTitle}`);
    if (!autoAddViewEl || !cardsContainerEl) { console.error("AutoAdd Render Error: Main view elements missing!"); viewManager.switchView('cards-container'); return; }
    if (!controlsBarEl) console.error("AutoAdd Render Error: Controls bar element missing!");

    autoAddViewEl.style.display = 'flex';
    cardsContainerEl.innerHTML = '';
    cardsContainerEl.classList.remove('entry-view-grid');
    cardsContainerEl.style.gridTemplateColumns = '';

    updateControlsBar();

    if (step === 'title') {
        console.log("AutoAdd: Rendering Title Step (Anime Folders)...");
        cardsContainerEl.style.gridTemplateColumns = 'repeat(auto-fill, minmax(190px, 1fr))';
        cardsContainerEl.innerHTML = `<p data-translate="autoAddLoadingTitles" class="loading-message">${translate('autoAddLoadingTitles')}</p>`;
        const data = await loadPredefinedData();
        if (currentDisplayTitle !== null || state.getCurrentView() !== 'auto-add-view') { console.log("Aborting title render."); return; }
        cardsContainerEl.innerHTML = '';
        const titles = Object.keys(data).sort((a, b) => a.localeCompare(b));
        if (titles.length === 0) { cardsContainerEl.innerHTML = `<p class="no-entries-message">No predefined titles found.</p>`; return; }

        titles.forEach(title => {
            const card = document.createElement('div');
            card.classList.add('auto-add-title-card');
            card.dataset.animeTitle = title;
            const titleData = predefinedAnimeData[title] || {};
            let imageUrl = titleData.image || constants.DEFAULT_IMAGE;
            if (typeof imageUrl !== 'string' || (!imageUrl.startsWith('http') && imageUrl !== constants.DEFAULT_IMAGE)) {
                 imageUrl = constants.DEFAULT_IMAGE;
            }
            card.style.backgroundImage = `url('${imageUrl}')`;
            if (imageUrl === constants.DEFAULT_IMAGE) { card.style.backgroundColor = '#444'; }
            const titleNameDiv = document.createElement('div'); titleNameDiv.classList.add('auto-add-title-card-name'); titleNameDiv.textContent = title; card.appendChild(titleNameDiv);
            card.classList.add(getTitleSelectionStatus(title));
            card.addEventListener('click', () => { currentDisplayTitle = title; renderAutoAddView('entry'); });
            cardsContainerEl.appendChild(card);
        });
        console.log("AutoAdd: Title Step Rendered.");

    } else if (step === 'entry' && currentDisplayTitle) {
        console.log(`AutoAdd: Rendering Entry Step (Anime Options) for: ${currentDisplayTitle}`);
        cardsContainerEl.classList.add('entry-view-grid');
        cardsContainerEl.innerHTML = `<p class="loading-message" data-translate="autoAddLoadingEntries" data-translate-placeholders='{"title": "${currentDisplayTitle}"}'>${translate('autoAddLoadingEntries', { title: currentDisplayTitle })}</p>`;
        const entriesData = predefinedAnimeData?.[currentDisplayTitle];
        if (!currentDisplayTitle || state.getCurrentView() !== 'auto-add-view') { console.log("Aborting entry render."); return; }
        cardsContainerEl.innerHTML = '';
        if (!entriesData || typeof entriesData !== 'object') { console.error(`Data missing for title: ${currentDisplayTitle}`); cardsContainerEl.innerHTML = `<p class="no-entries-message">Error loading entries data.</p>`; updateControlsBar(); return; }

        let entriesFound = false; let totalEntriesForTitle = 0; let selectedEntriesForTitle = 0;
        const selectAllCard = document.createElement('div'); selectAllCard.className = 'auto-add-entry-card auto-add-select-all-card'; selectAllCard.style.cursor = 'pointer'; cardsContainerEl.appendChild(selectAllCard);

        constants.ALLOWED_SEASON_TYPES.forEach(type => {
            if (entriesData[type] && Array.isArray(entriesData[type]) && entriesData[type].length > 0) {
                entriesFound = true;
                const sortedEntries = [...entriesData[type]].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
                totalEntriesForTitle += sortedEntries.length;
                sortedEntries.forEach(entry => {
                    const item = document.createElement('div');
                    item.classList.add('auto-add-entry-card');
                    item.style.cursor = 'pointer';
                    const entryNumber = entry.number ?? null;
                    const entryUniqueId = `${currentDisplayTitle}__${type}__${entryNumber === null ? 'N' : entryNumber}`;
                    item.dataset.entryId = entryUniqueId;

                    const maxEp = parseInt(entry.max_episodes, 10);
                    const entryData = {
                        uniqueId: entryUniqueId,
                        title: currentDisplayTitle,
                        type: type,
                        number: entryNumber,
                        name: entry.name?.trim() || `${currentDisplayTitle} ${type}${entryNumber !== null ? ' '+entryNumber : ''}`.trim(),
                        max_episodes: (!isNaN(maxEp) && maxEp >= 0) ? maxEp : (type === 'Movie' ? 1 : 0)
                    };

                    let numberPart = entryNumber !== null ? ` ${entryNumber}` : ''; const defaultConstructedName = `${translate(`seasonType${type.replace('-', '')}`)}${numberPart}`.trim();
                    const typeDiv = document.createElement('div'); typeDiv.className = 'entry-card-type'; typeDiv.textContent = translate(`seasonType${type.replace('-', '')}`);
                    const nameDiv = document.createElement('div'); nameDiv.className = 'entry-card-name'; nameDiv.textContent = (entryData.name && entryData.name.toLowerCase() !== defaultConstructedName.toLowerCase()) ? entryData.name : defaultConstructedName;

                    const episodesDiv = document.createElement('div');
                    episodesDiv.className = 'entry-card-episodes';
                    let episodeTextPart = '';
                    if (type === 'Movie' || entryData.max_episodes === 1) episodeTextPart = '(1 ep)';
                    else if (type === 'Scan' && entryData.max_episodes > 0) episodeTextPart = `(${entryData.max_episodes} ch)`;
                    else if (entryData.max_episodes > 0) episodeTextPart = `(${entryData.max_episodes} ep)`;
                    else episodeTextPart = `(? ep)`;

                    let fullEpisodeText = '';
                    if (entryNumber !== null) {
                        fullEpisodeText = `#${entryNumber} / ${episodeTextPart}`;
                    } else {
                        fullEpisodeText = episodeTextPart;
                    }
                    episodesDiv.textContent = fullEpisodeText;

                    item.append(typeDiv, nameDiv, episodesDiv);

                    const isGloballySelected = globallySelectedEntries.some(sel => sel.uniqueId === entryUniqueId);
                    if (isGloballySelected) { item.classList.add('selected'); selectedEntriesForTitle++; }

                    item.addEventListener('click', () => {
                        const wasSelected = item.classList.toggle('selected');
                        if (wasSelected) {
                            if (!globallySelectedEntries.some(sel => sel.uniqueId === entryUniqueId)) {
                                globallySelectedEntries.push(entryData);
                            }
                            selectedEntriesForTitle++;
                        } else {
                            globallySelectedEntries = globallySelectedEntries.filter(sel => sel.uniqueId !== entryUniqueId);
                            selectedEntriesForTitle--;
                        }
                        updateControlsBar();
                        updateSelectAllCardState(selectAllCard, selectedEntriesForTitle, totalEntriesForTitle);
                    });
                    cardsContainerEl.appendChild(item);
                });
            }
        });

        selectAllCard.addEventListener('click', () => {
             const shouldSelectAll = selectedEntriesForTitle < totalEntriesForTitle;
             const entryCards = cardsContainerEl.querySelectorAll('.auto-add-entry-card:not(.auto-add-select-all-card)');
            entryCards.forEach(item => {
                const currentEntryUniqueId = item.dataset.entryId; if (!currentEntryUniqueId) return;
                const alreadySelected = item.classList.contains('selected');
                const parts = currentEntryUniqueId.split('__');
                const title = parts[0]; const type = parts[1]; const numberStr = parts[2];
                const number = numberStr === 'N' ? null : parseInt(numberStr, 10);
                const baseEntry = predefinedAnimeData[title]?.[type]?.find(e => (e.number ?? null) === number); if (!baseEntry) return;
                const maxEp = parseInt(baseEntry.max_episodes, 10);
                const entryData = {
                    uniqueId: currentEntryUniqueId, title: title, type: type, number: number,
                    name: baseEntry.name?.trim() || `${title} ${type}${number !== null ? ' '+number : ''}`.trim(),
                    max_episodes: (!isNaN(maxEp) && maxEp >= 0) ? maxEp : (type === 'Movie' ? 1 : 0)
                };
                if (shouldSelectAll && !alreadySelected) {
                    item.classList.add('selected');
                    if (!globallySelectedEntries.some(sel => sel.uniqueId === currentEntryUniqueId)) {
                        globallySelectedEntries.push(entryData);
                    }
                } else if (!shouldSelectAll && alreadySelected) {
                    item.classList.remove('selected');
                    globallySelectedEntries = globallySelectedEntries.filter(sel => sel.uniqueId !== currentEntryUniqueId);
                }
            });
            selectedEntriesForTitle = shouldSelectAll ? totalEntriesForTitle : 0;
            updateControlsBar(); updateSelectAllCardState(selectAllCard, selectedEntriesForTitle, totalEntriesForTitle);
        });

        updateSelectAllCardState(selectAllCard, selectedEntriesForTitle, totalEntriesForTitle);
        if (!entriesFound) { cardsContainerEl.innerHTML = `<p class="no-entries-message" data-translate="autoAddNoEntries" data-translate-placeholders='{"title": "${currentDisplayTitle}"}'>${translate('autoAddNoEntries', { title: currentDisplayTitle })}</p>`; selectAllCard.style.display = 'none'; }
        console.log("AutoAdd: Entry Step Rendered.");

    } else {
        console.warn(`AutoAdd: Invalid step "${step}" or missing title for entry step.`);
        viewManager.switchView('cards-container');
    }
}

async function confirmAddSelectedEntries() {
     if (!confirmButtonEl || !backButtonEl || !cancelButtonEl) { console.error("Cannot confirm add, buttons missing."); return; }
     if (globallySelectedEntries.length === 0) { Toast.fire({ icon: 'warning', title: translate('autoAddSelectAnEntry') }); return; }
     confirmButtonEl.disabled = true; backButtonEl.disabled = true; cancelButtonEl.disabled = true;
     const processingToast = Toast.fire({ icon: 'info', title: translate('toastAdding'), timer: null, showConfirmButton: false, timerProgressBar: false });
     let successCount = 0; let errorCount = 0; let firstErrorMsg = null;
     const entriesToAdd = [...globallySelectedEntries];

     for (const entry of entriesToAdd) {
         const mainAnimeImageData = predefinedAnimeData?.[entry.title]?.image || '';
         const animeData = {
             name: entry.title,
             seasonType: entry.type,
             seasonNumber: entry.number,
             totalEpisodes: entry.max_episodes,
             image: mainAnimeImageData
         };
         try { const result = await ipcRenderer.invoke('addAnimeEntry', animeData); if (result.success) successCount++; else { errorCount++; const err = translate(result.error, { fallback: result.error || translate('toastAddedError') }); if (!firstErrorMsg) firstErrorMsg = err; console.warn(`Failed add ${entry.uniqueId}: ${result.error}`); } }
         catch (error) { errorCount++; if (!firstErrorMsg) firstErrorMsg = translate('toastErrorIPC'); console.error(`IPC Error add ${entry.uniqueId}:`, error); }
     }
     processingToast.close();
     if (errorCount === 0) { Toast.fire({ icon: 'success', title: translate('addedNEntriesSuccess', { count: successCount }) }); clearSelections(); viewManager.switchView('cards-container'); const loadCardsFunc = state.getLoadCardsFunction?.(); if (loadCardsFunc) setTimeout(loadCardsFunc, 50); }
     else { Toast.fire({ icon: 'warning', title: translate('addedNFailedMError', { n: successCount, m: errorCount, error: firstErrorMsg || 'Unknown error' }), timer: 5000 }); }
     if (errorCount > 0 || state.getCurrentView() === 'auto-add-view') { backButtonEl.disabled = false; cancelButtonEl.disabled = false; confirmButtonEl.disabled = globallySelectedEntries.length === 0; }
}

function clearSelections() {
    console.log("AutoAdd: Clearing selections and state.");
    globallySelectedEntries = [];
    currentDisplayTitle = null;
    const countSpan = confirmButtonEl?.querySelector('#auto-add-selection-count');
    if (countSpan) countSpan.textContent = '(0)';
    if (confirmButtonEl) confirmButtonEl.disabled = true;
    if (cardsContainerEl) cardsContainerEl.innerHTML = '';
}

function setupAutoAddView() {
    console.log("AutoAdd: Setting up view and listeners...");
    autoAddViewEl = document.getElementById('auto-add-view');
    if (autoAddViewEl) { cardsContainerEl = autoAddViewEl.querySelector('#auto-add-cards-container'); }
    controlsBarEl = document.getElementById('auto-add-controls-bar');
    backButtonEl = document.getElementById('auto-add-back-button');
    cancelButtonEl = document.getElementById('auto-add-cancel-button');
    confirmButtonEl = document.getElementById('auto-add-confirm-button');
    let missingElements = [];
    if (!autoAddViewEl) missingElements.push('#auto-add-view');
    if (!cardsContainerEl) missingElements.push('#auto-add-cards-container');
    if (!controlsBarEl) missingElements.push('#auto-add-controls-bar');
    if (!backButtonEl) missingElements.push('#auto-add-back-button');
    if (!cancelButtonEl) missingElements.push('#auto-add-cancel-button');
    if (!confirmButtonEl) missingElements.push('#auto-add-confirm-button');
    if (missingElements.length > 0) { console.error(`AutoAdd Setup Error: Could not find the following essential elements: ${missingElements.join(', ')}. Auto-add feature will be disabled.`); return; }
    backButtonEl.addEventListener('click', () => { console.log("AutoAdd: Back button clicked."); currentDisplayTitle = null; renderAutoAddView('title'); });
    cancelButtonEl.addEventListener('click', () => { console.log("AutoAdd: Cancel button clicked."); clearSelections(); viewManager.switchView('cards-container'); });
    confirmButtonEl.addEventListener('click', confirmAddSelectedEntries);
    console.log("AutoAdd: Setup complete.");
}

function activateAutoAddView(viewId) {
    console.log(`AutoAdd: Activating view ${viewId}`);
    if (viewId === 'auto-add-view') {
        if (controlsBarEl) controlsBarEl.style.display = 'flex';
        else console.error("AutoAdd Activate: Controls bar element not found!");
        currentDisplayTitle = null;
        renderAutoAddView('title');
    } else {
        console.warn(`AutoAdd: activateAutoAddView called with unexpected viewId: ${viewId}`);
    }
}

module.exports = { setupAutoAddView, activateAutoAddView, clearSelections };