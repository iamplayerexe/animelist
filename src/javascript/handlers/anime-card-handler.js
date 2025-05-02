// <-- comment (.js file)(src/javascript/handlers/anime-card-handler.js)
const { ipcRenderer } = require('electron');
const Swal = require('sweetalert2');
const elements = require('../dom-elements');
const constants = require('../constants');
const state = require('../state');
const { translate, formatDisplayTitle, Toast } = require('../utils');

// --- Function to handle saving episode updates ---
async function saveEpisodeData(animeId, watchedCount, totalCount) {
    console.log(`Attempting to save episode data for ${animeId}: Watched=${watchedCount}, Total=${totalCount}`);
    try {
        let animeAfterUpdate = null;
        let needsWatchedUpdate = true;
        const targetWatched = parseInt(watchedCount, 10);
        // Check if totalCount is provided and different from undefined/null before attempting update
        if (totalCount !== undefined && totalCount !== null) {
            console.log(`Calling updateTotalEpisodes for ${animeId} with total ${totalCount}`);
            const totalResult = await ipcRenderer.invoke('updateTotalEpisodes', animeId, totalCount);
            if (!totalResult.success) {
                Toast.fire({ icon: 'error', title: totalResult.error || 'Error updating total episodes.' });
                return { success: false, error: totalResult.error || 'Error updating total episodes.' };
            }
            animeAfterUpdate = totalResult.updatedAnime;
            console.log(`Total episodes update successful. Intermediate state:`, animeAfterUpdate);
            // Check if the watched count ALREADY matches the target after the total update (e.g., watched was capped)
            if (animeAfterUpdate && animeAfterUpdate.watchedEpisodes === targetWatched) {
                console.log("Watched count matches target after total update. Skipping watched update.");
                needsWatchedUpdate = false;
            }
        }

        // Proceed with watched update only if needed
        if (needsWatchedUpdate) {
             // Get the current state, either from the intermediate update or by fetching fresh data
             const currentState = animeAfterUpdate || (await ipcRenderer.invoke('getAnimes')).find(a => a.id === animeId);
             if (!currentState) {
                 console.error(`Could not get current state for anime ${animeId} before watched update.`);
                 return { success: false, error: 'Could not verify current state.' };
             }

             // Only send the update if the target is different from the current state
             if (currentState.watchedEpisodes !== targetWatched) {
                console.log(`Calling updateWatchedEpisodes for ${animeId} with watched ${targetWatched}`);
                const watchedResult = await ipcRenderer.invoke('updateWatchedEpisodes', animeId, targetWatched);
                if (!watchedResult.success) {
                    Toast.fire({ icon: 'error', title: watchedResult.error || translate('toastEpisodeUpdateError') });
                    return { success: false, error: watchedResult.error || translate('toastEpisodeUpdateError'), partialState: animeAfterUpdate }; // Include partial state if total update succeeded
                }
                animeAfterUpdate = watchedResult.updatedAnime; // Update with the latest state
                console.log(`Watched episodes update successful. Final state:`, animeAfterUpdate);
             } else {
                 console.log(`Watched count (${targetWatched}) same as current. No watched update sent.`);
                 if (!animeAfterUpdate) animeAfterUpdate = currentState; // Ensure we have a state to return
             }
        }

        // Return the final state (potentially after both updates, one update, or no updates)
        return { success: true, updatedAnime: animeAfterUpdate };
    } catch (error) {
        console.error("IPC Error during saveEpisodeData:", error);
        Toast.fire({ icon: 'error', title: translate('toastCommError') });
        return { success: false, error: translate('toastCommError') };
    }
}


// --- Helper function to validate and save popup data ---
// REMOVED - Integrated directly into preConfirm

// --- Create Anime Card (Flex Column Structure) ---
function createAnimeCard(anime, loadCardsFunc) {
    console.log(`createAnimeCard: Starting card creation for ID: ${anime?.id}, Name: ${anime?.name}`);
    if (!anime || typeof anime.id === 'undefined' || typeof anime.name === 'undefined') {
        console.error("createAnimeCard Error: Invalid anime data provided:", anime);
        return null;
    }

    let card;
    try {
        card = document.createElement('div');
        card.classList.add('anime-card'); // Base class with flex column
        card.dataset.animeId = anime.id;

        // Use a local variable to hold the current state for this card instance
        // This avoids race conditions if multiple cards update near-simultaneously
        let cardAnimeData = { ...anime };

        // --- Create elements and append directly to the card in order ---
        const image = document.createElement('img');
        image.src = cardAnimeData.image && cardAnimeData.image.trim() ? cardAnimeData.image : constants.DEFAULT_IMAGE;
        image.alt = cardAnimeData.name || translate('imageAltDefault', { fallback: 'Anime Image' });
        image.classList.add('anime-image');
        image.onerror = (e) => { console.warn(`Image failed to load for ${cardAnimeData.name}. Error: ${e.type}`); e.target.src = constants.DEFAULT_IMAGE; };
        card.appendChild(image);

        const animeTitleDiv = document.createElement('div');
        animeTitleDiv.classList.add('anime-title');
        // Use utility function for title display
        const { displayTitle, seasonSuffix } = formatDisplayTitle(cardAnimeData.name, cardAnimeData.seasonType, cardAnimeData.seasonNumber);
        animeTitleDiv.textContent = displayTitle + seasonSuffix;
        // Generate full title for tooltip
        let fullTitle = cardAnimeData.name || translate('swalDetailsUnknown');
        const typeKey = `seasonType${(cardAnimeData.seasonType || constants.DEFAULT_SEASON_TYPE).replace('-', '')}`;
        const translatedType = translate(typeKey, { fallback: cardAnimeData.seasonType || constants.DEFAULT_SEASON_TYPE });
        if (cardAnimeData.seasonType === 'Season' && cardAnimeData.seasonNumber) {
            fullTitle += ` (S${cardAnimeData.seasonNumber})`;
        } else if (cardAnimeData.seasonType) {
             const numPart = (cardAnimeData.seasonNumber !== null && cardAnimeData.seasonNumber > 0 && cardAnimeData.seasonType !== 'Season') ? ` ${cardAnimeData.seasonNumber}` : '';
             fullTitle += ` (${translatedType}${numPart})`;
        }
        animeTitleDiv.title = fullTitle;
        card.appendChild(animeTitleDiv);

        const statusSelect = document.createElement('select');
        statusSelect.classList.add('anime-status-select');
        statusSelect.title = translate('cardStatusTitle');
        constants.STATUS_OPTIONS.forEach(statusValue => {
            const option = document.createElement('option');
            option.value = statusValue;
            const translationKey = `filter${statusValue.replace(/\s+/g, '')}`;
            option.textContent = translate(translationKey, { fallback: statusValue });
            if (statusValue === (cardAnimeData.status || constants.DEFAULT_STATUS)) {
                option.selected = true;
            }
            statusSelect.appendChild(option);
        });
        card.appendChild(statusSelect);

        const episodeDisplay = document.createElement('div');
        episodeDisplay.classList.add('anime-season-episodes');
        const watchedSpan = document.createElement('span');
        watchedSpan.classList.add('watched-episodes'); // Will get 'editable' class added dynamically
        const totalSpan = document.createElement('span');
        totalSpan.classList.add('total-episodes');
        // Spans will be appended inside updateCardUI
        card.appendChild(episodeDisplay);

        const controls = document.createElement('div');
        controls.classList.add('episode-controls'); // CSS will handle margin-top: auto
        const minusButton = document.createElement('button');
        minusButton.classList.add('card-button-style');
        minusButton.textContent = '-';
        const detailsButton = document.createElement('button');
        detailsButton.classList.add('card-button-style');
        detailsButton.textContent = translate('cardDetailsButtonText'); // Translate button text
        detailsButton.title = translate('cardDetailsButtonTitle'); // Translate button title
        const plusButton = document.createElement('button');
        plusButton.classList.add('card-button-style');
        plusButton.textContent = '+';
        controls.appendChild(minusButton);
        controls.appendChild(detailsButton);
        controls.appendChild(plusButton);
        card.appendChild(controls); // Append controls div to the card

        // --- Update Card UI function (accepts new data) ---
        const updateCardUI = (updatedAnimeData) => {
            // Update the card's local data state if new data is provided
            if(updatedAnimeData) {
                cardAnimeData = { ...updatedAnimeData };
            }
            const watchedCount = cardAnimeData.watchedEpisodes ?? 0;
            const totalCount = cardAnimeData.totalEpisodes ?? 0;
            const isSingleEpisodeItem = (totalCount === 1); // Check based on potentially updated total

            // Update status dropdown
            statusSelect.value = cardAnimeData.status || constants.DEFAULT_STATUS;
            statusSelect.disabled = false; // Re-enable after updates

            // Update episode display text/elements
            episodeDisplay.innerHTML = ''; // Clear first

            if (isSingleEpisodeItem) {
                const isWatched = watchedCount >= 1;
                episodeDisplay.textContent = `${translate('swalDetailsWatchedSimple', { fallback: 'Watched:' })} `;
                watchedSpan.textContent = isWatched ? translate('yes') : translate('no');
                watchedSpan.classList.remove('editable'); // Not editable in this mode
                episodeDisplay.appendChild(watchedSpan);
                // Hide total span completely for single episode items
                totalSpan.textContent = '';
                totalSpan.style.display = 'none';
                // Update button states and tooltips for single episode items
                minusButton.disabled = !isWatched;
                minusButton.title = translate('cardMarkAsUnwatchedTitle');
                plusButton.disabled = isWatched;
                plusButton.title = translate('cardMarkAsWatchedTitle');
            } else {
                episodeDisplay.textContent = `${translate('cardEpisodesLabel', { fallback: 'Episodes: ' })}`;
                watchedSpan.textContent = watchedCount;
                watchedSpan.classList.add('editable'); // Make watched count editable
                totalSpan.textContent = `/ ${totalCount}`;
                totalSpan.style.display = 'inline'; // Ensure total span is visible
                episodeDisplay.appendChild(watchedSpan);
                episodeDisplay.appendChild(totalSpan);
                // Update button states and tooltips for multi-episode items
                minusButton.disabled = watchedCount <= 0;
                minusButton.title = translate('cardMinusEpTitle');
                plusButton.disabled = watchedCount >= totalCount;
                plusButton.title = translate('cardPlusEpTitle');
            }

            // Ensure elements are displayed correctly
             episodeDisplay.style.display = 'block';
             minusButton.style.display = 'inline-flex';
             plusButton.style.display = 'inline-flex';

             // Re-enable details button
            detailsButton.disabled = false;
         };


        // --- Event Listeners ---
        // Inline edit for watched episodes
        const saveInlineEdit = async (inputElement) => {
            const newValue = inputElement.value.trim();
            const animeId = card.dataset.animeId;
            const currentWatched = cardAnimeData.watchedEpisodes ?? 0;
            const currentTotal = cardAnimeData.totalEpisodes ?? 0;
            const newWatchedNum = parseInt(newValue, 10);

            inputElement.remove(); // Remove input regardless of success/fail
            watchedSpan.style.display = 'inline'; // Show span again

            if (newValue === '' || isNaN(newWatchedNum) || newWatchedNum < 0 || newWatchedNum > currentTotal) {
                 Toast.fire({ icon: 'error', title: translate('toastEpisodeUpdateError', { fallback: 'Invalid episode count.' }) });
                 // updateCardUI(); // Revert UI if needed, but span is already shown
                 return;
             }

             if (newWatchedNum !== currentWatched) {
                 const result = await saveEpisodeData(animeId, newWatchedNum, undefined); // Only update watched
                 if (result && result.success) {
                     updateCardUI(result.updatedAnime); // Update UI with new data from backend
                 } else {
                     updateCardUI(cardAnimeData); // Revert UI to previous state on error
                 }
             }
             // else: No change, do nothing further
        };

        watchedSpan.addEventListener('click', (e) => {
            // Only allow editing if the span has the 'editable' class and no input exists
            const isSingleEpisodeItem = (cardAnimeData.totalEpisodes === 1);
            if (episodeDisplay.querySelector('.episodes-input-temp') || !watchedSpan.classList.contains('editable') || isSingleEpisodeItem) {
                 return;
            }

            const currentVal = cardAnimeData.watchedEpisodes ?? 0;
            const maxVal = cardAnimeData.totalEpisodes || 0;

            const input = document.createElement('input');
            input.type = 'number';
            input.classList.add('episodes-input-temp');
            input.value = currentVal;
            input.min = 0;
            input.max = maxVal;
            input.style.display = 'inline-block';

            watchedSpan.style.display = 'none'; // Hide the span
            // Insert input before the total span if it exists, otherwise append
            if(totalSpan.parentNode === episodeDisplay) {
                episodeDisplay.insertBefore(input, totalSpan);
            } else {
                episodeDisplay.appendChild(input);
            }

            input.focus();
            input.select();

            let saved = false;
            const handleSave = () => { if (!saved) { saved = true; saveInlineEdit(input); } };

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
                else if (e.key === 'Escape') { saved = true; input.remove(); watchedSpan.style.display = 'inline'; }
            });
            input.addEventListener('blur', () => {
                // On blur, only remove the input. Don't save automatically.
                // handleSave(); // Removed auto-save on blur
                 if (!saved) { // Ensure span is shown if save didn't happen
                     input.remove(); watchedSpan.style.display = 'inline';
                 }
            });
        });


        // Status Select Change
        statusSelect.addEventListener('change', async (event) => {
            const newStatus = event.target.value;
            const animeId = card.dataset.animeId;
            statusSelect.disabled = true; // Disable while processing
            const originalStatus = cardAnimeData.status; // Store original status

            try {
                const result = await ipcRenderer.invoke('updateAnimeStatus', animeId, newStatus);
                if (result.success && result.updatedAnime) {
                    Toast.fire({ icon: 'success', title: translate('toastStatusUpdateSuccess') });
                    updateCardUI(result.updatedAnime); // Update local data and UI

                    // Reload cards if view needs filtering based on new status
                    if (state.getCurrentView() === 'cards-container' && state.getCurrentStatusFilter() !== 'All' && state.getCurrentStatusFilter() !== result.updatedAnime.status) {
                        console.log(`Card ${animeId}: Status changed (${originalStatus} -> ${newStatus}), filter (${state.getCurrentStatusFilter()}) mismatch. Requesting card reload.`);
                        setTimeout(() => { if (loadCardsFunc) loadCardsFunc(); }, 0); // Use provided loadCards function
                    }
                } else {
                    Toast.fire({ icon: 'error', title: result.error || translate('toastStatusUpdateError') });
                    event.target.value = originalStatus; // Revert dropdown on error
                    statusSelect.disabled = false; // Re-enable
                }
            } catch (error) {
                console.error("IPC Error 'updateAnimeStatus':", error);
                Toast.fire({ icon: 'error', title: translate('toastCommError') });
                event.target.value = originalStatus; // Revert dropdown on IPC error
                statusSelect.disabled = false; // Re-enable
                updateCardUI(cardAnimeData); // Ensure UI reflects original state
            }
        });

        // Watched Episode Button Clicks (+/-)
        const handleEpisodeUpdate = async (newCount) => {
             // Disable controls during update
             minusButton.disabled = true; plusButton.disabled = true; detailsButton.disabled = true; statusSelect.disabled = true;

            const animeId = card.dataset.animeId;
            const originalAnimeState = { ...cardAnimeData }; // Snapshot before update

            const result = await saveEpisodeData(animeId, newCount, undefined); // Update only watched count

            if (result && result.success) {
                 const statusBeforeUpdate = originalAnimeState.status;
                 updateCardUI(result.updatedAnime); // Update UI with new data

                 // Check if status changed AND filter requires reload
                 if (result.updatedAnime.status !== statusBeforeUpdate && state.getCurrentView() === 'cards-container' && state.getCurrentStatusFilter() !== 'All' && state.getCurrentStatusFilter() !== result.updatedAnime.status) {
                     console.log(`Card ${animeId}: Watched update caused status change (${statusBeforeUpdate} -> ${result.updatedAnime.status}), filter (${state.getCurrentStatusFilter()}) mismatch. Requesting card reload.`);
                     setTimeout(() => { if (loadCardsFunc) loadCardsFunc(); }, 0);
                 }
             } else {
                 // Show error if one was returned, otherwise show generic comm error
                 if (!result?.error) {
                     Toast.fire({ icon: 'error', title: translate('toastCommError') });
                 }
                 updateCardUI(originalAnimeState); // Revert UI to state before the failed update attempt
            }
            // Re-enable controls (will be set correctly by updateCardUI based on new state)
        };

        minusButton.addEventListener('click', () => {
            if (!minusButton.disabled) {
                const isSingleEpisodeItem = (cardAnimeData.totalEpisodes === 1);
                if (isSingleEpisodeItem) {
                    handleEpisodeUpdate(0); // Mark as unwatched
                } else {
                    const cw = cardAnimeData.watchedEpisodes ?? 0;
                    if (cw > 0) { handleEpisodeUpdate(cw - 1); }
                }
            }
        });

        plusButton.addEventListener('click', () => {
            if (!plusButton.disabled) {
                const isSingleEpisodeItem = (cardAnimeData.totalEpisodes === 1);
                if (isSingleEpisodeItem) {
                    handleEpisodeUpdate(1); // Mark as watched
                } else {
                    const cw = cardAnimeData.watchedEpisodes ?? 0;
                    const ct = cardAnimeData.totalEpisodes ?? 0;
                    if (cw < ct) { handleEpisodeUpdate(cw + 1); }
                }
            }
        });

        // --- Details Button Listener ---
        detailsButton.addEventListener('click', () => {
            console.log(`Details button clicked for anime ID: ${cardAnimeData.id}, Name: ${cardAnimeData.name}`);
             try {
                 // --- Keep initial variable definitions the same ---
                 const initialWatched = cardAnimeData.watchedEpisodes ?? 0;
                 const initialTotal = cardAnimeData.totalEpisodes ?? 0;
                 const currentStatus = cardAnimeData.status || constants.DEFAULT_STATUS;
                 const currentSeasonType = cardAnimeData.seasonType || constants.DEFAULT_SEASON_TYPE;
                 const currentAnimeId = cardAnimeData.id;

                 const { displayTitle: detailsDisplayTitle, seasonSuffix: detailsSeasonSuffix } = formatDisplayTitle(cardAnimeData.name, currentSeasonType, cardAnimeData.seasonNumber);
                 const detailsTitleText = detailsDisplayTitle + detailsSeasonSuffix;

                 const typeKey = `seasonType${currentSeasonType.replace('-', '')}`;
                 const translatedType = translate(typeKey, { fallback: currentSeasonType });

                 let numberLabelKey = `swalAdd${currentSeasonType.replace('-', '')}NumberLabel`;
                 const numberLabelText = translate(numberLabelKey, { fallback: translate('swalDetailsNumber') });
                 let seasonNumberText = translate('swalDetailsNumberNA', { fallback: 'N/A' });
                 if (cardAnimeData.seasonNumber !== null && cardAnimeData.seasonNumber !== undefined) {
                     seasonNumberText = cardAnimeData.seasonNumber;
                 }

                 const statusKey = `filter${currentStatus.replace(/\s+/g, '')}`;
                 const translatedStatus = translate(statusKey, { fallback: currentStatus });

                 // --- MODIFIED: contentHtml generation using divs and classes ---
                 const contentHtml = `
                 <div class="swal-details-content">
                    <div class="detail-row">
                        <strong>${translate('swalDetailsOfficialTitle')}</strong>
                        <span class="detail-value">${cardAnimeData.name || translate('swalDetailsUnknown')}</span>
                    </div>
                    <div class="detail-row">
                        <strong>${translate('swalDetailsType')}</strong>
                        <span class="detail-value">${translatedType}</span>
                    </div>
                    <div class="detail-row">
                        <strong>${numberLabelText}</strong>
                        <span class="detail-value">${seasonNumberText}</span>
                    </div>
                    <div class="detail-row" id="swal-watched-row">
                        <strong id="swal-watched-label"></strong>
                        <span id="swal-watched-value-container">
                            <input type="number" id="swal-detail-watched" min="0" value="${initialWatched}">
                            <span class="episodes-separator" id="swal-watched-slash">/</span>
                            <span class="episodes-total-simple" id="swal-watched-total-simple">${initialTotal}</span>
                            <input type="checkbox" id="swal-detail-watched-checkbox" style="display: none;">
                            <span id="swal-watched-checkbox-label" style="display: none;"></span>
                        </span>
                    </div>
                    <div class="detail-row" id="swal-total-row">
                        <strong id="swal-total-label">${translate('swalDetailsTotalEpisodes')}</strong>
                        <span>
                            <input type="number" id="swal-detail-total" min="0" value="${initialTotal}">
                        </span>
                    </div>
                    <div class="detail-row">
                        <strong>${translate('swalDetailsStatus')}</strong>
                        <span class="detail-value">${translatedStatus}</span>
                    </div>
                 </div>`;
                 // --- END MODIFIED ---

                 const imageUrl = cardAnimeData.image && cardAnimeData.image.startsWith('http') ? cardAnimeData.image : constants.DEFAULT_IMAGE;
                console.log("Attempting to call Swal.fire...");
                Swal.fire({
                    title: detailsTitleText,
                    imageUrl: imageUrl,
                    imageHeight: 180,
                    imageAlt: cardAnimeData.name,
                    customClass: { popup: 'details-popup swal2-popup', image: 'swal2-image', htmlContainer: 'swal2-html-container', },
                    html: contentHtml,
                    color: '#FFFFFF', background: '#333',
                    confirmButtonColor: '#4488FF', confirmButtonText: translate('swalCloseButton'),
                    showDenyButton: true, denyButtonText: translate('swalDeleteButton'), denyButtonColor: '#d33',
                    width: 'auto',
                    focusConfirm: true,
                    allowOutsideClick: false, allowEscapeKey: true,
                    // --- MODIFIED: didOpen function to handle new structure ---
                    didOpen: (popup) => {
                        const watchedInput = popup.querySelector('#swal-detail-watched');
                        const watchedLabel = popup.querySelector('#swal-watched-label');
                        const watchedSlash = popup.querySelector('#swal-watched-slash');
                        const watchedTotalSimple = popup.querySelector('#swal-watched-total-simple');
                        const watchedRow = popup.querySelector('#swal-watched-row'); // The whole row
                        const watchedCheckbox = popup.querySelector('#swal-detail-watched-checkbox');
                        const watchedCheckboxLabel = popup.querySelector('#swal-watched-checkbox-label');

                        const totalInput = popup.querySelector('#swal-detail-total');
                        const totalLabel = popup.querySelector('#swal-total-label');
                        const totalRow = popup.querySelector('#swal-total-row'); // The whole row

                        if (!watchedInput || !watchedLabel || !watchedSlash || !watchedTotalSimple || !watchedRow || !watchedCheckbox || !watchedCheckboxLabel || !totalInput || !totalLabel || !totalRow) {
                             console.error("Details Popup didOpen: Could not find all required elements."); return;
                        }

                        const isSingleEpisodeItemPopup = (initialTotal === 1);

                        if (isSingleEpisodeItemPopup) {
                            watchedLabel.textContent = translate('swalDetailsWatchedSimple');
                            watchedInput.style.display = 'none';       // Hide number input
                            watchedSlash.style.display = 'none';       // Hide slash
                            watchedTotalSimple.style.display = 'none'; // Hide total number
                            watchedCheckbox.style.display = 'inline-block'; // Show checkbox
                            watchedCheckbox.checked = initialWatched >= 1;
                            watchedCheckbox.disabled = false; // Allow checking/unchecking
                            watchedCheckboxLabel.style.display = 'inline-block';
                            watchedCheckboxLabel.textContent = watchedCheckbox.checked ? translate('yes') : translate('no');

                            // Hide Total Episodes row completely
                            totalRow.style.display = 'none';
                            totalInput.disabled = true; // Disable underlying input just in case

                            // Update checkbox label on change
                            watchedCheckbox.addEventListener('change', () => {
                                watchedCheckboxLabel.textContent = watchedCheckbox.checked ? translate('yes') : translate('no');
                            });

                        } else {
                            watchedLabel.textContent = translate('swalDetailsWatched');
                            watchedInput.style.display = 'inline-block'; // Show number input
                            watchedInput.max = initialTotal; // Set max based on total
                            watchedInput.disabled = false;
                            watchedCheckbox.style.display = 'none';    // Hide checkbox
                            watchedCheckboxLabel.style.display = 'none';
                            watchedSlash.style.display = 'inline-block'; // Show slash
                            watchedTotalSimple.style.display = 'inline-block'; // Show total number
                            watchedTotalSimple.textContent = initialTotal; // Ensure total is displayed

                            // Show Total Episodes row
                            totalRow.style.display = 'grid'; // Use grid display for the row
                            totalInput.min = 0;
                            totalInput.disabled = false;

                             // Add validation listener if needed for total episodes
                             totalInput.addEventListener('input', () => {
                                const newTotalVal = parseInt(totalInput.value, 10);
                                if (!isNaN(newTotalVal) && newTotalVal >= 0) {
                                    watchedInput.max = newTotalVal; // Update max of watched input
                                    watchedTotalSimple.textContent = newTotalVal; // Update simple total display
                                }
                             });
                        }

                        // Event listener for Enter key remains the same
                        const saveFromEnter = async (event) => { if (event.key === 'Enter') { event.preventDefault(); Swal.clickConfirm(); } };
                        watchedInput.addEventListener('keydown', saveFromEnter);
                        totalInput.addEventListener('keydown', saveFromEnter);
                        // Add for checkbox if desired
                        watchedCheckbox.addEventListener('keydown', saveFromEnter);
                    },
                    // --- MODIFIED: preConfirm to read from correct input and perform validation/save ---
                    preConfirm: async () => {
                        const popup = Swal.getPopup(); if (!popup) return false;

                        const watchedInput = popup.querySelector('#swal-detail-watched');
                        const watchedCheckbox = popup.querySelector('#swal-detail-watched-checkbox');
                        const totalInput = popup.querySelector('#swal-detail-total');

                        if (!watchedInput || !watchedCheckbox || !totalInput) return false;

                        const isSingleEpisodeItemPopup = (cardAnimeData.totalEpisodes === 1);
                        let watchedValue = '';
                        if (isSingleEpisodeItemPopup) {
                            watchedValue = watchedCheckbox.checked ? '1' : '0';
                        } else {
                            watchedValue = watchedInput.value;
                        }

                        const totalValue = totalInput.value;

                        // --- VALIDATION LOGIC ---
                        const initialWatchedForValidation = cardAnimeData.watchedEpisodes ?? 0;
                        const initialTotalForValidation = cardAnimeData.totalEpisodes ?? 0;
                        let newWatchedNum = parseInt(watchedValue.trim(), 10);
                        let newTotalNum = parseInt(totalValue.trim(), 10);
                        let needsSave = false;

                        // Validate Total Episodes (only if not single episode item and not disabled)
                         if (!isSingleEpisodeItemPopup && !totalInput.disabled) {
                             if (totalValue.trim() === '' || isNaN(newTotalNum) || newTotalNum < 0) {
                                 Swal.showValidationMessage(translate('swalValidationEpisodes'));
                                 totalInput.focus();
                                 return false; // Use false directly for validation failure
                             }
                             if (newTotalNum !== initialTotalForValidation) needsSave = true;
                         } else {
                             // For single episode items, total should always be 1
                             newTotalNum = 1;
                             if(initialTotalForValidation !== 1) needsSave = true; // Correct if initial data was wrong
                         }

                        // Validate Watched Episodes
                         if (!watchedInput.disabled || !watchedCheckbox.disabled) { // Check if the relevant control is enabled
                             const maxWatched = newTotalNum; // Use the validated/set total
                             if (watchedValue.trim() === '' || isNaN(newWatchedNum) || newWatchedNum < 0 || newWatchedNum > maxWatched) {
                                 const message = isSingleEpisodeItemPopup
                                     ? `Invalid state` // Should not happen with checkbox really
                                     : `Invalid Watched Episodes (must be 0-${maxWatched})`;
                                 Swal.showValidationMessage(message);
                                 if (!isSingleEpisodeItemPopup) watchedInput.focus();
                                 return false; // Validation failure
                             }
                             if (newWatchedNum !== initialWatchedForValidation) needsSave = true;
                         } else {
                             newWatchedNum = initialWatchedForValidation; // Keep original if disabled
                         }

                         // Proceed with saving if needed
                         if (needsSave) {
                             console.log(`Popup save needed: Watched=${newWatchedNum}, Total=${newTotalNum}`);
                             Swal.showLoading(Swal.getConfirmButton());
                             // Use the original saveEpisodeData function
                             const result = await saveEpisodeData(currentAnimeId, newWatchedNum, newTotalNum);
                             Swal.hideLoading();
                             if (result && result.success) {
                                 Toast.fire({icon:'success', title: translate('operationSuccess')});
                                 // Update cardAnimeData locally AFTER successful save
                                 cardAnimeData = result.updatedAnime;
                                 return true; // Indicate success
                             } else {
                                 Swal.showValidationMessage(result?.error || "Failed to save changes.");
                                 if (!isSingleEpisodeItemPopup && !totalInput.disabled) totalInput.focus(); // Focus total if watched disabled
                                 else if (!isSingleEpisodeItemPopup) watchedInput.focus();
                                 return false; // Indicate failure
                             }
                         } else {
                             console.log("Popup save: No valid changes detected.");
                             // Even if no save, return true to close the dialog
                             return true;
                         }
                         // --- END VALIDATION LOGIC ---
                    },
                    preDeny: () => { // --- Keep preDeny the same ---
                        return new Promise((resolve) => { Swal.fire({ title: translate('swalDeleteConfirmTitle'), html: translate('swalDeleteConfirmHtml', { title: `<strong>${detailsTitleText}</strong>` }), icon: 'warning', background: '#333', color: '#FFF', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#6c757d', confirmButtonText: translate('swalDeleteConfirmButton'), cancelButtonText: translate('swalCancelButton'), customClass: { popup: 'swal2-popup' } }).then((cr) => { resolve(cr.isConfirmed); }); });
                    }
                 })
                .then(async (result) => { // --- Keep .then() logic the same, check result.value ---
                    console.log("Swal 'then' block entered. Result:", result);
                    if (result.isDenied) {
                        try {
                            const dr = await ipcRenderer.invoke('deleteAnime', currentAnimeId);
                            if (dr.success) {
                                Toast.fire({ icon: 'success', title: translate('toastDeleteSuccess') });
                                setTimeout(() => { if (loadCardsFunc) loadCardsFunc(); }, 0); // Reload cards on successful delete
                            } else {
                                Toast.fire({ icon: 'error', title: dr.error || translate('toastDeleteError') });
                            }
                        } catch (error) {
                            console.error('IPC Error deleteAnime:', error);
                            Toast.fire({ icon: 'error', title: translate('toastErrorIPC') });
                        }
                    } else if (result.isConfirmed && result.value === true) { // Check if preConfirm succeeded
                        console.log("Details popup closed via Close button AFTER successful update or no changes needed.");
                        // Reload cards ONLY if preConfirm indicated success (changes were saved or none needed)
                        if (loadCardsFunc) setTimeout(() => loadCardsFunc(), 0);
                    } else if (result.isDismissed) {
                        console.log("Details popup dismissed (Cancel/Escape).");
                        // Update UI with potentially modified local state if preConfirm failed mid-way or was cancelled
                        updateCardUI(cardAnimeData);
                     } else if (result.isConfirmed && result.value === false) {
                        console.log("Details popup 'Close' clicked, but preConfirm validation failed or save error occurred.");
                        // Don't reload cards, validation message should be visible.
                        // Revert UI maybe? Or assume Swal handles showing the error?
                         updateCardUI(cardAnimeData); // Revert UI to be safe
                    }
                })
                .catch(swalError => {
                    console.error("Error occurred within Swal.fire promise chain:", swalError);
                    Toast.fire({ icon: 'error', title: translate('errorOccurred') });
                });
                console.log("Swal.fire call completed.");
             } catch (error) {
                 console.error("Error preparing data for details popup:", error);
                 Toast.fire({ icon: 'error', title: translate('errorOccurred') });
             }
        });

        // Initial UI Render for the card
        updateCardUI(cardAnimeData);
        return card;

    } catch (error) {
        console.error(`createAnimeCard Error creating card structure for ID: ${anime?.id}:`, error);
        return null; // Return null if card creation fails
    }
}


// --- Load Cards Function ---
async function loadCards() {
    console.log("loadCards function called.");
    const container = elements.cardsContainer;
    if (!container) {
        console.error("loadCards Error: Card container (#cards-container) not found.");
        return;
    }
    try {
        console.log("loadCards: Setting loading message.");
        container.innerHTML = ''; // Clear previous content
        container.innerHTML = `<p class="loading-message">${translate('loadingCardsMsg')}</p>`;

        console.log("loadCards: Invoking 'getAnimes' IPC handler...");
        const allAnimes = await ipcRenderer.invoke('getAnimes');
        console.log(`loadCards: Received ${Array.isArray(allAnimes) ? allAnimes.length : 'INVALID DATA ('+ typeof allAnimes + ')'} animes from main process.`);

        container.innerHTML = ''; // Clear loading message

        if (!Array.isArray(allAnimes)) {
            console.error("loadCards Error: Data received from 'getAnimes' is not an array.");
            throw new Error(translate('errorLoadingDataMsg'));
        }

        const currentStatusFilter = state.getCurrentStatusFilter();
        const currentTypeFilter = state.getCurrentTypeFilter();
        console.log(`loadCards: Filtering with Status='${currentStatusFilter}', Type='${currentTypeFilter}'`);

        if(allAnimes.length > 0) {
            console.log("loadCards: Structure of first anime BEFORE filtering:", JSON.stringify(allAnimes[0]));
        }

        const filteredAnimes = allAnimes.filter(anime => {
            // Ensure anime object is valid before accessing properties
            if (!anime) return false;
            const status = anime.status || constants.DEFAULT_STATUS;
            const type = anime.seasonType || constants.DEFAULT_SEASON_TYPE;
            const statusMatch = currentStatusFilter === 'All' || status === currentStatusFilter;
            const typeMatch = currentTypeFilter === 'All' || type === currentTypeFilter;
            return statusMatch && typeMatch;
        });

        console.log(`loadCards: Found ${filteredAnimes.length} animes after filtering.`);

        if(filteredAnimes.length > 0) {
             console.log("loadCards: Structure of first anime AFTER filtering:", JSON.stringify(filteredAnimes[0]));
        }


        if (filteredAnimes.length > 0) {
            // Sort animes: Primary by name (case-insensitive), Secondary by type order, Tertiary by number
            filteredAnimes.sort((a, b) => {
                const nameA = a.name || '';
                const nameB = b.name || '';
                const nameCompare = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
                if (nameCompare !== 0) return nameCompare;

                const typeOrder = constants.ALLOWED_SEASON_TYPES;
                const typeA = a.seasonType || constants.DEFAULT_SEASON_TYPE;
                const typeB = b.seasonType || constants.DEFAULT_SEASON_TYPE;
                const indexA = typeOrder.indexOf(typeA);
                const indexB = typeOrder.indexOf(typeB);
                const typeCompare = indexA - indexB;
                if (typeCompare !== 0) return typeCompare;

                // Handle null/undefined season numbers gracefully
                const numA = (a.seasonNumber === null || a.seasonNumber === undefined) ? -Infinity : a.seasonNumber;
                const numB = (b.seasonNumber === null || b.seasonNumber === undefined) ? -Infinity : b.seasonNumber;
                return numA - numB;
            });

            console.log("loadCards: Appending cards to container...");
            let successfulAppends = 0;
            filteredAnimes.forEach(anime => {
                // Check container existence inside the loop in case it gets removed by other processes
                if (!document.getElementById('cards-container')) {
                     console.error("loadCards FATAL: #cards-container disappeared during card appending!");
                     throw new Error("Card container removed unexpectedly during render.");
                }
                // Pass the loadCards function itself to createAnimeCard for potential reloads
                const cardElement = createAnimeCard(anime, loadCards);
                if (cardElement) {
                    container.appendChild(cardElement);
                    successfulAppends++;
                } else {
                    console.warn(`Skipped appending card for anime ID ${anime?.id} due to creation error.`);
                }
            });
            console.log(`loadCards: Card appending complete. Appended ${successfulAppends} cards.`);
            if (successfulAppends === 0 && filteredAnimes.length > 0) {
                console.error("loadCards Error: Filtered animes exist, but 0 cards were successfully appended.");
                container.innerHTML = `<p class="error-message">Error rendering cards. Check console.</p>`;
            }
        } else {
            // Display appropriate 'no anime' message based on filters
            let message = '';
            const statusActive = currentStatusFilter !== 'All';
            const typeActive = currentTypeFilter !== 'All';

            if (!statusActive && !typeActive) {
                // No filters active
                message = translate('noAnimeMsgBase') + ` ${translate('noAnimeMsgAddPrompt')}`;
            } else {
                // At least one filter is active
                const statusKey = `filter${currentStatusFilter.replace(/\s+/g, '')}`;
                const tStatus = statusActive ? translate(statusKey, { fallback: currentStatusFilter }) : '';
                const typeKey = `seasonType${currentTypeFilter.replace('-', '')}`; // Handle Non-Canon
                const tType = typeActive ? translate(typeKey, { fallback: currentTypeFilter }) : '';

                if (statusActive && !typeActive) {
                    message = translate('noAnimeMsgStatusFilter', { status: tStatus });
                } else if (!statusActive && typeActive) {
                    message = translate('noAnimeMsgTypeFilter', { type: tType });
                } else { // Both filters active
                    message = translate('noAnimeMsgCombinedFilter', { status: tStatus, type: tType });
                }
            }
            console.log("loadCards: Displaying 'no anime' message:", message);
            container.innerHTML = `<p class="no-anime-message">${message}</p>`;
        }
    } catch (error) {
        console.error('Error during loadCards execution:', error);
        // Display error message in the container
        if (container) { // Check if container still exists
            container.innerHTML = `<p class="error-message">${translate('errorLoadingCardsMsg', { error: error.message })}</p>`;
        }
        // Show toast notification
        Toast.fire({ icon: 'error', title: translate('errorLoadingCardsMsg', { error: '' }).replace(': {error}', '') });
    }
}


module.exports = { loadCards };
// <-- end comment (.js file)(src/javascript/handlers/anime-card-handler.js)