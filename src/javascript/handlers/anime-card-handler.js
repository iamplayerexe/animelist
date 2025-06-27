// src/javascript/handlers/anime-card-handler.js
const { ipcRenderer } = require('electron');
const Swal = require('sweetalert2');
const elements = require('../dom-elements');
const constants = require('../constants');
const state = require('../state');
const { translate, formatDisplayTitle, Toast } = require('../utils');

async function saveEpisodeData(animeId, watchedCount, totalCount) {
    console.log(`Attempting to save episode data for ${animeId}: Watched=${watchedCount}, Total=${totalCount}`);
    try {
        let animeAfterUpdate = null;
        let needsWatchedUpdate = true;
        const targetWatched = parseInt(watchedCount, 10);
        if (totalCount !== undefined && totalCount !== null) {
            console.log(`Calling updateTotalEpisodes for ${animeId} with total ${totalCount}`);
            const totalResult = await ipcRenderer.invoke('updateTotalEpisodes', animeId, totalCount);
            if (!totalResult.success) {
                Toast.fire({ icon: 'error', title: totalResult.error || 'Error updating total episodes.' });
                return { success: false, error: totalResult.error || 'Error updating total episodes.' };
            }
            animeAfterUpdate = totalResult.updatedAnime;
            console.log(`Total episodes update successful. Intermediate state:`, animeAfterUpdate);
            if (animeAfterUpdate && animeAfterUpdate.watchedEpisodes === targetWatched) {
                console.log("Watched count matches target after total update. Skipping watched update.");
                needsWatchedUpdate = false;
            }
        }

        if (needsWatchedUpdate) {
             const currentState = animeAfterUpdate || (await ipcRenderer.invoke('getAnimes')).find(a => a.id === animeId);
             if (!currentState) {
                 console.error(`Could not get current state for anime ${animeId} before watched update.`);
                 return { success: false, error: 'Could not verify current state.' };
             }

             if (currentState.watchedEpisodes !== targetWatched) {
                console.log(`Calling updateWatchedEpisodes for ${animeId} with watched ${targetWatched}`);
                const watchedResult = await ipcRenderer.invoke('updateWatchedEpisodes', animeId, targetWatched);
                if (!watchedResult.success) {
                    Toast.fire({ icon: 'error', title: watchedResult.error || translate('toastEpisodeUpdateError') });
                    return { success: false, error: watchedResult.error || translate('toastEpisodeUpdateError'), partialState: animeAfterUpdate };
                }
                animeAfterUpdate = watchedResult.updatedAnime;
                console.log(`Watched episodes update successful. Final state:`, animeAfterUpdate);
             } else {
                 console.log(`Watched count (${targetWatched}) same as current. No watched update sent.`);
                 if (!animeAfterUpdate) animeAfterUpdate = currentState;
             }
        }

        return { success: true, updatedAnime: animeAfterUpdate };
    } catch (error) {
        console.error("IPC Error during saveEpisodeData:", error);
        Toast.fire({ icon: 'error', title: translate('toastCommError') });
        return { success: false, error: translate('toastCommError') };
    }
}

function createAnimeCard(anime, loadCardsFunc) {
    console.log(`createAnimeCard: Starting card creation for ID: ${anime?.id}, Name: ${anime?.name}`);
    if (!anime || typeof anime.id === 'undefined' || typeof anime.name === 'undefined') {
        console.error("createAnimeCard Error: Invalid anime data provided:", anime);
        return null;
    }

    let card;
    try {
        card = document.createElement('div');
        card.classList.add('anime-card');
        card.dataset.animeId = anime.id;

        let cardAnimeData = { ...anime };

        const image = document.createElement('img');
        image.src = cardAnimeData.image && cardAnimeData.image.trim() ? cardAnimeData.image : constants.DEFAULT_IMAGE;
        image.alt = cardAnimeData.name || translate('imageAltDefault', { fallback: 'Anime Image' });
        image.classList.add('anime-image');
        image.onerror = (e) => { console.warn(`Image failed to load for ${cardAnimeData.name}. Error: ${e.type}`); e.target.src = constants.DEFAULT_IMAGE; };
        card.appendChild(image);

        const animeTitleDiv = document.createElement('div');
        animeTitleDiv.classList.add('anime-title');
        
        // --- THIS IS THE FIX: Conditional title rendering ---
        if (cardAnimeData.entryName) {
            // New format for cards with entryName
            const entryTitleSpan = document.createElement('span');
            entryTitleSpan.className = 'entry-title';
            entryTitleSpan.textContent = cardAnimeData.entryName;

            const mainTitleSpan = document.createElement('span');
            mainTitleSpan.className = 'main-title-subtitle';
            mainTitleSpan.textContent = cardAnimeData.name;
            
            animeTitleDiv.append(entryTitleSpan, mainTitleSpan);
            animeTitleDiv.title = `${cardAnimeData.entryName} (${cardAnimeData.name})`;
        } else {
            // Old format for existing cards
            const { displayTitle, seasonSuffix } = formatDisplayTitle(cardAnimeData.name, cardAnimeData.seasonType, cardAnimeData.seasonNumber);
            animeTitleDiv.textContent = displayTitle + seasonSuffix;
            animeTitleDiv.title = displayTitle + seasonSuffix;
        }
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
        watchedSpan.classList.add('watched-episodes');
        const totalSpan = document.createElement('span');
        totalSpan.classList.add('total-episodes');
        card.appendChild(episodeDisplay);

        const controls = document.createElement('div');
        controls.classList.add('episode-controls');
        const minusButton = document.createElement('button');
        minusButton.classList.add('card-button-style');
        minusButton.textContent = '-';
        const detailsButton = document.createElement('button');
        detailsButton.classList.add('card-button-style');
        detailsButton.textContent = translate('cardDetailsButtonText');
        detailsButton.title = translate('cardDetailsButtonTitle');
        const plusButton = document.createElement('button');
        plusButton.classList.add('card-button-style');
        plusButton.textContent = '+';
        controls.appendChild(minusButton);
        controls.appendChild(detailsButton);
        controls.appendChild(plusButton);
        card.appendChild(controls);

        const updateCardUI = (updatedAnimeData) => {
            if(updatedAnimeData) {
                cardAnimeData = { ...updatedAnimeData };
            }
            const watchedCount = cardAnimeData.watchedEpisodes ?? 0;
            const totalCount = cardAnimeData.totalEpisodes ?? 0;
            const isSingleEpisodeItem = (totalCount === 1);

            statusSelect.value = cardAnimeData.status || constants.DEFAULT_STATUS;
            statusSelect.disabled = false;

            episodeDisplay.innerHTML = '';

            if (isSingleEpisodeItem) {
                const isWatched = watchedCount >= 1;
                episodeDisplay.textContent = `${translate('swalDetailsWatchedSimple', { fallback: 'Watched:' })} `;
                watchedSpan.textContent = isWatched ? translate('yes') : translate('no');
                watchedSpan.classList.remove('editable');
                episodeDisplay.appendChild(watchedSpan);
                totalSpan.textContent = '';
                totalSpan.style.display = 'none';
                minusButton.disabled = !isWatched;
                minusButton.title = translate('cardMarkAsUnwatchedTitle');
                plusButton.disabled = isWatched;
                plusButton.title = translate('cardMarkAsWatchedTitle');
            } else {
                episodeDisplay.textContent = `${translate('cardEpisodesLabel', { fallback: 'Episodes: ' })}`;
                watchedSpan.textContent = watchedCount;
                watchedSpan.classList.add('editable');
                totalSpan.textContent = `/ ${totalCount}`;
                totalSpan.style.display = 'inline';
                episodeDisplay.appendChild(watchedSpan);
                episodeDisplay.appendChild(totalSpan);
                minusButton.disabled = watchedCount <= 0;
                minusButton.title = translate('cardMinusEpTitle');
                plusButton.disabled = watchedCount >= totalCount;
                plusButton.title = translate('cardPlusEpTitle');
            }

             episodeDisplay.style.display = 'block';
             minusButton.style.display = 'inline-flex';
             plusButton.style.display = 'inline-flex';

            detailsButton.disabled = false;
         };

        const saveInlineEdit = async (inputElement) => {
            const newValue = inputElement.value.trim();
            const animeId = card.dataset.animeId;
            const currentWatched = cardAnimeData.watchedEpisodes ?? 0;
            const currentTotal = cardAnimeData.totalEpisodes ?? 0;
            const newWatchedNum = parseInt(newValue, 10);

            inputElement.remove();
            watchedSpan.style.display = 'inline';

            if (newValue === '' || isNaN(newWatchedNum) || newWatchedNum < 0 || newWatchedNum > currentTotal) {
                 Toast.fire({ icon: 'error', title: translate('toastEpisodeUpdateError', { fallback: 'Invalid episode count.' }) });
                 return;
             }

             if (newWatchedNum !== currentWatched) {
                 const result = await saveEpisodeData(animeId, newWatchedNum, undefined);
                 if (result && result.success) {
                     updateCardUI(result.updatedAnime);
                 } else {
                     updateCardUI(cardAnimeData);
                 }
             }
        };

        watchedSpan.addEventListener('click', (e) => {
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

            watchedSpan.style.display = 'none';
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
                 if (!saved) {
                     input.remove(); watchedSpan.style.display = 'inline';
                 }
            });
        });

        statusSelect.addEventListener('change', async (event) => {
            const newStatus = event.target.value;
            const animeId = card.dataset.animeId;
            statusSelect.disabled = true;
            const originalStatus = cardAnimeData.status;

            try {
                const result = await ipcRenderer.invoke('updateAnimeStatus', animeId, newStatus);
                if (result.success && result.updatedAnime) {
                    Toast.fire({ icon: 'success', title: translate('toastStatusUpdateSuccess') });
                    updateCardUI(result.updatedAnime);

                    if (state.getCurrentView() === 'cards-container' && state.getCurrentStatusFilter() !== 'All' && state.getCurrentStatusFilter() !== result.updatedAnime.status) {
                        setTimeout(() => { if (loadCardsFunc) loadCardsFunc(); }, 0);
                    }
                } else {
                    Toast.fire({ icon: 'error', title: result.error || translate('toastStatusUpdateError') });
                    event.target.value = originalStatus;
                    statusSelect.disabled = false;
                }
            } catch (error) {
                console.error("IPC Error 'updateAnimeStatus':", error);
                Toast.fire({ icon: 'error', title: translate('toastCommError') });
                event.target.value = originalStatus;
                statusSelect.disabled = false;
                updateCardUI(cardAnimeData);
            }
        });

        const handleEpisodeUpdate = async (newCount) => {
             minusButton.disabled = true; plusButton.disabled = true; detailsButton.disabled = true; statusSelect.disabled = true;

            const animeId = card.dataset.animeId;
            const originalAnimeState = { ...cardAnimeData };

            const result = await saveEpisodeData(animeId, newCount, undefined);

            if (result && result.success) {
                 const statusBeforeUpdate = originalAnimeState.status;
                 updateCardUI(result.updatedAnime);

                 if (result.updatedAnime.status !== statusBeforeUpdate && state.getCurrentView() === 'cards-container' && state.getCurrentStatusFilter() !== 'All' && state.getCurrentStatusFilter() !== result.updatedAnime.status) {
                     setTimeout(() => { if (loadCardsFunc) loadCardsFunc(); }, 0);
                 }
             } else {
                 if (!result?.error) {
                     Toast.fire({ icon: 'error', title: translate('toastCommError') });
                 }
                 updateCardUI(originalAnimeState);
            }
        };

        minusButton.addEventListener('click', () => {
            if (!minusButton.disabled) {
                const isSingleEpisodeItem = (cardAnimeData.totalEpisodes === 1);
                if (isSingleEpisodeItem) {
                    handleEpisodeUpdate(0);
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
                    handleEpisodeUpdate(1);
                } else {
                    const cw = cardAnimeData.watchedEpisodes ?? 0;
                    const ct = cardAnimeData.totalEpisodes ?? 0;
                    if (cw < ct) { handleEpisodeUpdate(cw + 1); }
                }
            }
        });

        detailsButton.addEventListener('click', () => {
            const initialWatched = cardAnimeData.watchedEpisodes ?? 0;
            const initialTotal = cardAnimeData.totalEpisodes ?? 0;
            const currentStatus = cardAnimeData.status || constants.DEFAULT_STATUS;
            const currentSeasonType = cardAnimeData.seasonType || constants.DEFAULT_SEASON_TYPE;
            const currentAnimeId = cardAnimeData.id;

            // --- THIS IS THE FIX: Conditional title for details popup ---
            let detailsTitleText;
            if (cardAnimeData.entryName) {
                detailsTitleText = cardAnimeData.entryName;
            } else {
                const { displayTitle, seasonSuffix } = formatDisplayTitle(cardAnimeData.name, currentSeasonType, cardAnimeData.seasonNumber);
                detailsTitleText = displayTitle + seasonSuffix;
            }
            // --- End of Fix ---

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

            const contentHtml = `
             <div class="swal-details-content">
                <div class="detail-row">
                    <strong>${translate('swalDetailsOfficialTitle')}</strong>
                    <span>${cardAnimeData.name || translate('swalDetailsUnknown')}</span>
                </div>
                <div class="detail-row">
                    <strong>${translate('swalDetailsType')}</strong>
                    <span>${translatedType}</span>
                </div>
                <div class="detail-row">
                    <strong>${numberLabelText}</strong>
                    <span>${seasonNumberText}</span>
                </div>
                <div class="detail-row" id="swal-watched-row">
                    <strong id="swal-watched-label"></strong>
                    <span id="swal-watched-value-container">
                        <input type="number" id="swal-detail-watched" min="0" value="${initialWatched}">
                        <span class="episodes-separator"> / </span>
                        <span class="episodes-total-simple">${initialTotal}</span>
                        <input type="checkbox" id="swal-detail-watched-checkbox" style="display: none;">
                    </span>
                </div>
                <div class="detail-row" id="swal-total-row">
                    <strong>${translate('swalDetailsTotalEpisodes')}</strong>
                    <span><input type="number" id="swal-detail-total" min="0" value="${initialTotal}"></span>
                </div>
                <div class="detail-row">
                    <strong>${translate('swalDetailsStatus')}</strong>
                    <span>${translatedStatus}</span>
                </div>
             </div>`;

            const imageUrl = cardAnimeData.image && cardAnimeData.image.trim() ? cardAnimeData.image : constants.DEFAULT_IMAGE;

            Swal.fire({
                title: detailsTitleText,
                imageUrl: imageUrl,
                imageHeight: 180,
                imageAlt: cardAnimeData.name,
                html: contentHtml,
                customClass: { popup: 'details-popup swal2-popup' },
                showDenyButton: true,
                showCancelButton: false,
                confirmButtonText: translate('swalCloseButton'),
                denyButtonText: translate('swalDeleteButton'),
                focusConfirm: false,
                didOpen: (popup) => {
                    const watchedInput = popup.querySelector('#swal-detail-watched');
                    const watchedLabel = popup.querySelector('#swal-watched-label');
                    const watchedSlash = popup.querySelector('#swal-watched-slash');
                    const watchedTotalSimple = popup.querySelector('#swal-watched-total-simple');
                    const watchedCheckbox = popup.querySelector('#swal-detail-watched-checkbox');
                    const totalInput = popup.querySelector('#swal-detail-total');
                    const totalRow = popup.querySelector('#swal-total-row');

                    const isSingleEpisodeItemPopup = (initialTotal === 1);

                    if (isSingleEpisodeItemPopup) {
                        watchedLabel.textContent = translate('swalDetailsWatchedSimple');
                        watchedInput.style.display = 'none';
                        watchedSlash.style.display = 'none';
                        watchedTotalSimple.style.display = 'none';
                        watchedCheckbox.style.display = 'inline-block';
                        watchedCheckbox.checked = initialWatched >= 1;
                        totalRow.style.display = 'none';
                    } else {
                        watchedLabel.textContent = translate('swalDetailsWatched');
                        watchedInput.max = initialTotal;
                        totalRow.style.display = 'grid';
                        totalInput.addEventListener('input', () => {
                            const newTotalVal = parseInt(totalInput.value, 10);
                            if (!isNaN(newTotalVal) && newTotalVal >= 0) {
                                watchedInput.max = newTotalVal;
                                watchedTotalSimple.textContent = newTotalVal;
                            }
                        });
                    }
                },
                preConfirm: async () => {
                    const watchedInput = document.getElementById('swal-detail-watched');
                    const totalInput = document.getElementById('swal-detail-total');
                    const watchedCheckbox = document.getElementById('swal-detail-watched-checkbox');
                    const isSingle = (cardAnimeData.totalEpisodes === 1);

                    const newWatched = parseInt(isSingle ? (watchedCheckbox.checked ? 1 : 0) : watchedInput.value, 10);
                    const newTotal = isSingle ? 1 : parseInt(totalInput.value, 10);

                    if (newWatched !== initialWatched || (!isSingle && newTotal !== initialTotal)) {
                        Swal.showLoading();
                        const totalToSend = isSingle ? undefined : (newTotal !== initialTotal ? newTotal : undefined);
                        const result = await saveEpisodeData(currentAnimeId, newWatched, totalToSend);
                        if (!result.success) {
                            Swal.showValidationMessage(`Error: ${result.error}`);
                            return false;
                        }
                        return result.updatedAnime;
                    }
                    return true;
                },
                preDeny: () => {
                    return Swal.fire({
                        title: translate('swalDeleteConfirmTitle'),
                        html: translate('swalDeleteConfirmHtml', { title: `<strong>${detailsTitleText}</strong>` }),
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: translate('swalDeleteConfirmButton'),
                        cancelButtonText: translate('swalCancelButton'),
                        customClass: { popup: 'swal2-popup' }
                    }).then(cr => cr.isConfirmed);
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    loadCardsFunc();
                } else if (result.isDenied) {
                    ipcRenderer.invoke('deleteAnime', currentAnimeId).then(res => {
                        if (res.success) {
                            Toast.fire({ icon: 'success', title: translate('toastDeleteSuccess') });
                            loadCardsFunc();
                        } else {
                            Toast.fire({ icon: 'error', title: res.error || translate('toastDeleteError') });
                        }
                    });
                }
            });
        });

        updateCardUI(cardAnimeData);
        return card;
    } catch (error) {
        console.error(`createAnimeCard Error creating card structure for ID: ${anime?.id}:`, error);
        return null;
    }
}

function loadCards() {
    const container = elements.cardsContainer;
    container.innerHTML = `<p class="loading-message">${translate('loadingCardsMsg')}</p>`;
    ipcRenderer.invoke('getAnimes').then(allAnimes => {
        container.innerHTML = '';
        const filteredAnimes = allAnimes.filter(anime => {
            const statusMatch = state.getCurrentStatusFilter() === 'All' || (anime.status || constants.DEFAULT_STATUS) === state.getCurrentStatusFilter();
            const typeMatch = state.getCurrentTypeFilter() === 'All' || (anime.seasonType || constants.DEFAULT_SEASON_TYPE) === state.getCurrentTypeFilter();
            return statusMatch && typeMatch;
        });

        if (filteredAnimes.length > 0) {
            filteredAnimes.sort((a,b) => a.name.localeCompare(b.name)).forEach(anime => {
                const cardElement = createAnimeCard(anime, loadCards);
                if (cardElement) container.appendChild(cardElement);
            });
        } else {
            container.innerHTML = `<p class="no-anime-message">${translate('noAnimeMsgBase')}</p>`;
        }
    }).catch(err => {
        container.innerHTML = `<p class="error-message">Error loading animes.</p>`;
    });
}

module.exports = { loadCards };