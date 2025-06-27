// src/javascript/handlers/manual-add-handler.js
const { ipcRenderer } = require('electron');
const Swal = require('sweetalert2');
const elements = require('../dom-elements');
const state = require('../state');
const { translate, Toast, setButtonSuccess, setButtonError } = require('../utils');

let constantsModule;
let ALLOWED_SEASON_TYPES;
let DEFAULT_SEASON_TYPE;
try {
    constantsModule = require('../constants');
    if (!constantsModule || !constantsModule.ALLOWED_SEASON_TYPES || !constantsModule.DEFAULT_SEASON_TYPE) {
        throw new Error("Required constants not found.");
    }
    ALLOWED_SEASON_TYPES = constantsModule.ALLOWED_SEASON_TYPES;
    DEFAULT_SEASON_TYPE = constantsModule.DEFAULT_SEASON_TYPE;
} catch (err) {
    console.error("MANUAL-ADD-HANDLER: CRITICAL ERROR requiring constants!", err);
    ALLOWED_SEASON_TYPES = ['Season'];
    DEFAULT_SEASON_TYPE = 'Season';
}

async function showManualAddDialog() {
    const loadCardsFunc = state.getLoadCardsFunction();

    if (!ALLOWED_SEASON_TYPES || !Array.isArray(ALLOWED_SEASON_TYPES) || ALLOWED_SEASON_TYPES.length === 0) {
        console.error("Manual Add Dialog Error: ALLOWED_SEASON_TYPES is not valid.", ALLOWED_SEASON_TYPES);
        Swal.fire({
            icon: 'error', title: translate('errorOccurred'),
            text: translate('errorLoadingSeasonTypes'),
            customClass: { popup: 'swal2-popup' }
        });
        return;
    }

    let seasonTypeOptionsHTML = `<option value="" disabled selected>${translate('swalAddSeasonTypePlaceholder')}</option>`;
    ALLOWED_SEASON_TYPES.forEach(type => {
        const typeKey = `seasonType${type.replace('-', '')}`;
        const translatedType = translate(typeKey, { fallback: type });
        seasonTypeOptionsHTML += `<option value="${type}">${translatedType}</option>`;
    });

    const { value: formValues } = await Swal.fire({
        title: translate('swalAddTitle'),
        html: `
          <input id="swal-input-name" class="swal2-input swal-full-width-input" placeholder="${translate('swalAddNamePlaceholder')}" required>
          <div class="swal-input-row">
            <div class="swal-input-column">
              <label for="swal-input-season-type" class="swal2-input-label">${translate('swalAddSeasonTypeLabel')}</label>
              <select id="swal-input-season-type" class="swal2-select" required>
                  ${seasonTypeOptionsHTML}
              </select>
            </div>
            <div class="swal-input-column">
              <label id="swal-label-season-number" for="swal-input-season-number" class="swal2-input-label">${translate('swalAddSeasonNumberLabel')}</label>
              <input id="swal-input-season-number" type="number" min="0" class="swal2-input" placeholder="${translate('swalAddSeasonNumberPlaceholder')}">
            </div>
          </div>
          <div class="swal-input-row">
            <div class="swal-input-column">
              <label id="swal-label-episodes" for="swal-input-episodes" class="swal2-input-label">${translate('swalAddEpisodesPlaceholder')}</label>
              <input id="swal-input-episodes" type="number" min="0" class="swal2-input" placeholder="${translate('swalAddEpisodesPlaceholder')}" required>
            </div>
            <div class="swal-input-column">
              <label for="swal-input-image" class="swal2-input-label">${translate('swalAddImagePlaceholder')}</label>
              <input id="swal-input-image" class="swal2-input" placeholder="${translate('swalAddImagePlaceholder')}">
            </div>
          </div>
        `,
        focusConfirm: false,
        width: '650px',
        confirmButtonText: translate('swalAddButton'),
        showCancelButton: true, cancelButtonText: translate('swalCancelButton'),
        customClass: {
            popup: 'swal2-popup swal-add-anime-popup',
            htmlContainer: 'swal-add-html-container'
        },
        didOpen: () => {
            const popup = Swal.getPopup(); if (!popup) return;
            const nameInput = popup.querySelector('#swal-input-name'); nameInput?.focus();
            const typeSelect = popup.querySelector('#swal-input-season-type');
            const numberInput = popup.querySelector('#swal-input-season-number');
            const numberLabel = popup.querySelector('#swal-label-season-number');
            const episodesInput = popup.querySelector('#swal-input-episodes');
            const episodesLabel = popup.querySelector('#swal-label-episodes');
            if (!typeSelect || !numberInput || !numberLabel || !episodesInput || !episodesLabel) { console.error("Manual Add Dialog: Missing elements."); return; }
            const updateInputStates = (selectedType) => {
                let numberLabelKey = 'swalAddNonCanonNumberLabel'; let numberRequired = false; let numberMin = "0"; let episodesDisabled = false; let episodesValue = episodesInput.value;
                switch (selectedType) {
                    case 'Season': numberLabelKey = 'swalAddSeasonNumberLabel'; numberRequired = true; numberMin = "1"; episodesDisabled = false; if (episodesInput.disabled) episodesValue = ''; break;
                    case 'Movie': numberLabelKey = 'swalAddMovieNumberLabel'; numberRequired = false; numberMin = "0"; episodesDisabled = true; episodesValue = "1"; break;
                    case 'OAV': numberLabelKey = 'swalAddOAVNumberLabel'; numberRequired = false; numberMin = "0"; episodesDisabled = false; if (episodesInput.disabled) episodesValue = ''; break;
                    case 'Special': numberLabelKey = 'swalAddSpecialNumberLabel'; numberRequired = false; numberMin = "0"; episodesDisabled = false; if (episodesInput.disabled) episodesValue = ''; break;
                    case 'Scan': numberLabelKey = 'swalAddScanNumberLabel'; numberRequired = false; numberMin = "0"; episodesDisabled = false; if (episodesInput.disabled) episodesValue = ''; break;
                    case 'Non-Canon': numberLabelKey = 'swalAddNonCanonNumberLabel'; numberRequired = false; numberMin = "0"; episodesDisabled = false; if (episodesInput.disabled) episodesValue = ''; break;
                     default: numberLabelKey = 'swalAddNonCanonNumberLabel'; numberRequired = false; numberMin = "0"; episodesDisabled = false; if (episodesInput.disabled) episodesValue = ''; break;
                }
                numberLabel.textContent = translate(numberLabelKey); numberInput.required = numberRequired; numberInput.min = numberMin; if (!numberRequired) numberInput.setCustomValidity('');
                episodesInput.disabled = episodesDisabled; episodesInput.value = episodesValue; episodesInput.required = !episodesDisabled; if (episodesDisabled) episodesInput.setCustomValidity('');
            };
            updateInputStates(typeSelect.value); typeSelect.addEventListener('change', (e) => { updateInputStates(e.target.value); });
        },
        preConfirm: () => {
            document.getElementById('swal-input-name')?.setCustomValidity(''); document.getElementById('swal-input-season-type')?.setCustomValidity(''); document.getElementById('swal-input-season-number')?.setCustomValidity(''); document.getElementById('swal-input-episodes')?.setCustomValidity('');
            const nameInput = document.getElementById('swal-input-name')?.value; const seasonType = document.getElementById('swal-input-season-type')?.value; const seasonNumberInput = document.getElementById('swal-input-season-number')?.value; const episodesInput = document.getElementById('swal-input-episodes'); const episodes = episodesInput?.value; const image = document.getElementById('swal-input-image')?.value;
            if (!nameInput?.trim()) { Swal.showValidationMessage(translate('swalValidationTitle')); return false; }
            if (!seasonType) { Swal.showValidationMessage(translate('swalValidationSeasonType')); return false; }
            let seasonNumber = null;
            if (seasonType === 'Season') { const parsedNum = parseInt(seasonNumberInput, 10); if (!seasonNumberInput || isNaN(parsedNum) || parsedNum < 1) { Swal.showValidationMessage(translate('swalValidationSeasonNumber')); return false; } seasonNumber = parsedNum; }
            else if (seasonNumberInput && seasonNumberInput.trim() !== '') { const parsedNum = parseInt(seasonNumberInput, 10); if (isNaN(parsedNum) || parsedNum < 0) { Swal.showValidationMessage(translate('swalValidationSeasonNumber').replace('(>= 1)', '(>= 0)')); return false; } seasonNumber = parsedNum; }
            if (episodesInput && !episodesInput.disabled) { if (episodes === '' || parseInt(episodes, 10) < 0 || isNaN(parseInt(episodes, 10))) { Swal.showValidationMessage(translate('swalValidationEpisodes')); return false; } }
             return { name: nameInput.trim(), seasonType: seasonType, seasonNumber: seasonNumber, totalEpisodes: seasonType === 'Movie' ? 1 : parseInt(episodes, 10), image: image?.trim() || '', };
        }
    });

    if (formValues) {
        // --- THIS IS THE FIX: Add entryName: null to the data sent to the main process ---
        formValues.entryName = null; 
        
        const button = elements.addButton;
        if (!button) { console.error("Manual Add: Could not find addButton element for feedback."); return; }
        try {
            button.disabled = true;
            const processingToast = Toast.fire({ icon: 'info', title: translate('toastAdding'), timer: null, showConfirmButton: false, timerProgressBar: false });
            const result = await ipcRenderer.invoke('addAnimeEntry', formValues);
            processingToast.close();
            if (result.success) {
                setButtonSuccess(button, 'toastAddedSuccess');
                 if (state.getCurrentView() === 'cards-container' && loadCardsFunc) {
                    setTimeout(() => loadCardsFunc(), 0);
                }
            } else {
                const errorMsg = translate(result.error, { fallback: result.error || translate('toastAddedError') });
                setButtonError(button, errorMsg);
            }
        } catch (error) {
            console.error('IPC Error invoking addAnimeEntry:', error);
            const pt = Swal.getToast(); if (pt) pt.close();
            setButtonError(button, 'toastErrorIPC');
        } finally {
            if (!button.classList.contains('success')) {
                button.disabled = false;
            }
        }
    }
}

module.exports = { showManualAddDialog };