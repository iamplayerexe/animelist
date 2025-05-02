// <-- comment (.js file)(src/javascript/swal-dialogs.js)
// src/javascript/swal-dialogs.js
const { ipcRenderer } = require('electron');
const Swal = require('sweetalert2');
const elements = require('./dom-elements');
const state = require('./state');
const { translate, Toast, setButtonSuccess, setButtonError } = require('./utils');
const { showManualAddDialog } = require('./handlers/manual-add-handler');
// *** CORRECTED PATH: Sibling directory ***
const viewManager = require('./view-manager');

let loadCardsFunc;

function setupDialogs(_loadCardsFunc) {
    loadCardsFunc = _loadCardsFunc;
    state.setLoadCardsFunction?.(loadCardsFunc); // Ensure loadCards function is stored in state

    // --- Add Button Listener (Shows Choice Popup) ---
    elements.addButton?.addEventListener('click', async () => {
        const { value: addMethod } = await Swal.fire({
             title: translate('addAnimeMethodTitle'),
             input: 'radio',
             inputOptions: {
                 'automatic': translate('addAnimeMethodAutomatic'),
                 'manual': translate('addAnimeMethodManual')
             },
             // --- REMOVED THIS LINE ---
             // inputValue: 'automatic',
             // --- END REMOVED LINE ---
             inputValidator: (value) => !value && translate('swalImportModeValidation'), // Ensure a choice is made
             customClass: {
                 popup: 'swal2-popup choice-popup',
                 radio: 'swal2-radio choice-radio',
             },
             confirmButtonText: translate('autoAddContinue'),
             showCancelButton: true,
             cancelButtonText: translate('swalCancelButton'),
             confirmButtonColor: '#4488FF', // Swapped from deny
             cancelButtonColor: '#6c757d',
             background: '#333',
             color: '#FFF',
             didOpen: () => {
                  // Style the radio buttons to look like selectable boxes
                  const popup = Swal.getPopup(); if (!popup) return;
                  const radioContainer = popup.querySelector('.swal2-radio'); if (!radioContainer) return;
                  const radioLabels = radioContainer.querySelectorAll('label');
                  const radioInputs = radioContainer.querySelectorAll('input[type="radio"]');

                  const updateLabelStyles = (selectedValue) => {
                      radioLabels.forEach(label => {
                           // Find the input associated with this label more reliably
                           const input = label.querySelector('input[type="radio"]') || popup.querySelector(`input[type="radio"][id="${label.getAttribute('for')}"]`) || popup.querySelector(`input[type="radio"][value="${label.textContent.trim()}"]`); // Fallbacks
                           const isSelected = input && input.value === selectedValue;
                           label.classList.toggle('active', isSelected);
                      });
                  };

                  // Initially, no value is selected, so don't highlight anything
                  // const initialValue = popup.querySelector('input[type="radio"]:checked')?.value; // REMOVED initial check
                  // updateLabelStyles(initialValue); // REMOVED initial styling call

                  radioInputs.forEach(input => {
                      input.addEventListener('change', (event) => {
                          updateLabelStyles(event.target.value); // Update styles on change
                      });
                  });
              }
         });

        if (addMethod === 'automatic') {
            console.log("Automatic Add selected. Switching view...");
             if (window.electronAPI?.clearAutoAddSelections) { // Clear previous auto-add state if switching
                 window.electronAPI.clearAutoAddSelections();
             }
            viewManager.switchView('auto-add-view'); // Switch to the auto-add view
        } else if (addMethod === 'manual') {
            console.log("Manual Add selected. Showing manual dialog...");
            showManualAddDialog(); // Show the detailed manual add form
        } else {
             console.log("Add Anime choice cancelled.");
             if (window.electronAPI?.clearAutoAddSelections) { // Also clear if cancelled
                 window.electronAPI.clearAutoAddSelections();
             }
        }
    });


    // --- Import Button Listener ---
    elements.importButton?.addEventListener('click', async () => {
        const dialogResult = await ipcRenderer.invoke('openImportDialog');
        if (dialogResult.canceled || !dialogResult.filePaths?.length) {
            Toast.fire({ icon: 'info', title: translate('toastImportCancelled') });
            return;
        }
        const filePath = dialogResult.filePaths[0];
        const fileName = filePath.split(/[\\/]/).pop(); // Extract filename

        const { value: importMode } = await Swal.fire({
             title: translate('swalImportModeTitle'),
             html: translate('swalImportModeHtml', { filename: `<strong>${fileName}</strong>` }),
             icon: 'question',
             input: 'radio',
             inputOptions: {
                 'overwrite': translate('swalImportModeOverwrite'),
                 'merge': translate('swalImportModeMerge')
             },
             inputValidator: (value) => !value && translate('swalImportModeValidation'),
             confirmButtonText: translate('swalImportModeNext'),
             cancelButtonText: translate('swalCancelButton'),
             showCancelButton: true,
             confirmButtonColor: '#4488FF',
             cancelButtonColor: '#6c757d',
             background: '#333',
             color: '#FFF',
             customClass: {
                 popup: 'swal2-popup import-mode-popup', // Add specific class if needed
                 radio: 'swal2-radio'
             },
              didOpen: () => {
                  // Similar styling logic for import mode radio buttons if needed
                  const popup = Swal.getPopup(); if (!popup) return;
                  const radioContainer = popup.querySelector('.swal2-radio'); if (!radioContainer) return;
                  const radioLabels = radioContainer.querySelectorAll('label');
                  const radioInputs = radioContainer.querySelectorAll('input[type="radio"]');
                   const updateLabelStyles = (selectedValue) => {
                      radioLabels.forEach(label => {
                          const input = label.querySelector('input[type="radio"]');
                          const isSelected = input && input.value === selectedValue;
                          label.classList.toggle('active', isSelected);
                          // Optional: Add mode-specific active classes if defined in CSS
                          label.classList.toggle('active-overwrite', isSelected && input.value === 'overwrite');
                          label.classList.toggle('active-merge', isSelected && input.value === 'merge');
                      });
                  };
                   radioInputs.forEach(input => { input.addEventListener('change', (event) => { updateLabelStyles(event.target.value); }); });
                   // No initial value needed here either if you don't want pre-selection
              }
         });

        if (importMode) {
             const confirmTextKey = importMode === 'overwrite' ? 'swalImportConfirmOverwrite' : 'swalImportConfirmMerge';
             const confirmButtonColor = importMode === 'overwrite' ? '#d33' : '#4488FF'; // Red for overwrite
             const confirmButtonLabelKey = importMode === 'overwrite' ? 'swalImportConfirmButtonOverwrite' : 'swalImportConfirmButtonMerge';

            Swal.fire({
                title: translate('swalImportConfirmTitle'),
                text: translate(confirmTextKey),
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: translate(confirmButtonLabelKey),
                cancelButtonText: translate('swalCancelButton'),
                confirmButtonColor: confirmButtonColor,
                cancelButtonColor: '#6c757d',
                background: '#333', color: '#FFF',
                customClass: { popup: 'swal2-popup' }
            }).then(async (confirmationResult) => {
                if (confirmationResult.isConfirmed) {
                    const button = elements.importButton; // Get button for feedback
                    const otherButtons = [elements.exportButton, elements.clearDataButton];
                    try {
                        button.disabled = true; // Disable during operation
                        otherButtons.forEach(b => b.disabled = true);
                        const processingToast = Toast.fire({ icon: 'info', title: translate('toastImporting'), timer: null, showConfirmButton: false, timerProgressBar: false });

                        const importResult = await ipcRenderer.invoke('importData', filePath, importMode);

                        processingToast.close(); // Close processing toast

                        if (importResult.success) {
                            Toast.fire({ icon: 'success', title: translate('toastImportSuccess', { count: importResult.count }) });
                            // Reset filters and reload cards after successful import
                            state.setCurrentStatusFilter('All');
                            state.setCurrentTypeFilter('All');
                            const typeSelect = document.getElementById('type-filter-select');
                            if(typeSelect) typeSelect.value = 'All'; // Reset dropdown UI
                            const currentLoadCards = state.getLoadCardsFunction?.(); // Use getter
                            if(currentLoadCards) setTimeout(() => currentLoadCards(), 0); // Reload cards
                            // Note: We might still be in the 'data-management-view', viewManager handles active button state
                        } else {
                            const errorMsg = translate(importResult.error, { fallback: importResult.error || 'toastImportError' });
                            // setButtonError(button, errorMsg); // Show error on button (optional)
                            Swal.fire({ title: translate('swalImportErrorTitle'), text: errorMsg, icon: 'error', background: '#333', color: '#FFF', confirmButtonColor: '#4488FF', customClass: { popup: 'swal2-popup' } });
                        }
                    } catch (error) {
                        console.error("Import IPC Error:", error);
                        const errorMsg = translate('swalImportErrorIPCText');
                        // setButtonError(button, errorMsg); // Show error on button (optional)
                        Swal.fire({ title: translate('swalImportErrorIPC'), text: errorMsg, icon: 'error', background: '#333', color: '#FFF', confirmButtonColor: '#4488FF', customClass: { popup: 'swal2-popup' } });
                        const pt = Swal.getToast(); if (pt) pt.close(); // Close processing toast if still open
                    } finally {
                        // Re-enable buttons regardless of success/failure, unless success feedback is timed
                        // if (!button.classList.contains('success')) button.disabled = false;
                         button.disabled = false; // Simplier: just re-enable
                         otherButtons.forEach(b => b.disabled = false);
                    }
                } else {
                     // User cancelled the confirmation step
                     Toast.fire({ icon: 'info', title: translate('toastImportCancelled') });
                 }
             });
        } else {
             // User cancelled the mode selection step
             Toast.fire({ icon: 'info', title: translate('toastImportCancelled') });
        }
     });

    // --- Export Button Listener ---
    elements.exportButton?.addEventListener('click', async () => {
         const button = elements.exportButton;
         const otherButtons = [elements.importButton, elements.clearDataButton];
         try {
             button.disabled = true;
             otherButtons.forEach(b => b.disabled = true);
             const result = await ipcRenderer.invoke('openExportDialog');
             if (result.success) {
                 setButtonSuccess(button, 'toastExportSuccess'); // Timed success feedback
             } else if (!result.canceled) { // Only show error if it wasn't a cancellation
                 const errorMsg = translate(result.error, { fallback: result.error || 'toastExportError' });
                 setButtonError(button, errorMsg); // Timed error feedback
             } else {
                 Toast.fire({ icon: 'info', title: translate('toastExportCancelled') });
                 button.disabled = false; // Re-enable immediately if cancelled
             }
         } catch (error) {
             console.error("Export IPC Error:", error);
             const errorMsg = translate('toastErrorIPC');
             setButtonError(button, errorMsg); // Show timed error
         } finally {
             // Re-enable other buttons (export button handled by setButtonSuccess/Error timers or cancellation)
             otherButtons.forEach(b => b.disabled = false);
         }
     });

    // --- Clear Data Button Listener ---
    elements.clearDataButton?.addEventListener('click', () => {
         Swal.fire({
             title: translate('swalClearConfirmTitle'),
             html: translate('swalClearConfirmHtml'),
             icon: 'error', // Use error icon for high danger
             background: '#333', color: '#FFF',
             showCancelButton: true,
             confirmButtonColor: '#d33', // Red confirm button
             cancelButtonColor: '#6c757d',
             confirmButtonText: translate('swalClearConfirmButton'),
             cancelButtonText: translate('swalCancelButton'),
             customClass: { popup: 'swal2-popup' }
         }).then(async (result) => {
             if (result.isConfirmed) {
                 const button = elements.clearDataButton;
                 const otherButtons = [elements.importButton, elements.exportButton];
                 try {
                     button.disabled = true;
                     otherButtons.forEach(b => b.disabled = true);
                     const processingToast = Toast.fire({ icon: 'warning', title: translate('toastClearing'), timer: null, showConfirmButton: false, timerProgressBar: false });
                     const clearResult = await ipcRenderer.invoke('clearData');
                     processingToast.close();

                     if (clearResult.success) {
                         Toast.fire({ icon: 'success', title: translate('toastClearSuccess') });
                         // Reset filters and reload cards
                         state.setCurrentStatusFilter('All');
                         state.setCurrentTypeFilter('All');
                         const typeSelect = document.getElementById('type-filter-select');
                         if(typeSelect) typeSelect.value = 'All';
                         const currentLoadCards = state.getLoadCardsFunction?.();
                         if(currentLoadCards) setTimeout(() => currentLoadCards(), 0);
                         // Optionally switch back to cards view? Or leave in data view? Assuming leave.
                     } else {
                         const errorMsg = translate(clearResult.error, { fallback: clearResult.error || 'toastClearError' });
                         setButtonError(button, errorMsg); // Show timed error
                     }
                 } catch (error) {
                     console.error("Clear Data IPC Error:", error);
                     const errorMsg = translate('toastErrorIPC');
                     setButtonError(button, errorMsg); // Show timed error
                     const pt = Swal.getToast(); if (pt) pt.close(); // Close processing toast if still open
                 } finally {
                     // Re-enable buttons (clear button handled by setButtonError timer)
                     if(!button.classList.contains('error')) button.disabled = false; // Re-enable if no error
                     otherButtons.forEach(b => b.disabled = false);
                 }
             }
         });
     });

    console.log("Dialogs setup complete.");
}

module.exports = { setupDialogs };
// <-- end comment (.js file)(src/javascript/swal-dialogs.js)