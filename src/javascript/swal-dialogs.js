// src/javascript/swal-dialogs.js
const { ipcRenderer } = require('electron');
const Swal = require('sweetalert2');
const elements = require('./dom-elements');
const state = require('./state');
const { translate, Toast, setButtonSuccess, setButtonError } = require('./utils');
const { showManualAddDialog } = require('./handlers/manual-add-handler');
const viewManager = require('./view-manager');

let loadCardsFunc;

function setupDialogs(_loadCardsFunc) {
    loadCardsFunc = _loadCardsFunc;
    state.setLoadCardsFunction?.(loadCardsFunc);

    elements.addButton?.addEventListener('click', async () => {
        const { value: addMethod } = await Swal.fire({
             title: translate('addAnimeMethodTitle'),
             input: 'radio',
             inputOptions: {
                 'automatic': translate('addAnimeMethodAutomatic'),
                 'manual': translate('addAnimeMethodManual')
             },
             inputValidator: (value) => !value && translate('swalImportModeValidation'),
             customClass: {
                 popup: 'swal2-popup choice-popup',
                 radio: 'swal2-radio',
                 label: 'swal2-radio-label'
             },
             showCancelButton: true,
             confirmButtonText: translate('autoAddContinue'),
             cancelButtonText: translate('swalCancelButton'),
             // --- THIS IS THE FIX: Disabled automatic focus ---
             focusConfirm: false,
         });

        if (addMethod === 'automatic') {
            viewManager.switchView('auto-add-view');
        } else if (addMethod === 'manual') {
            showManualAddDialog();
        }
    });

    elements.importButton?.addEventListener('click', async () => {
        const dialogResult = await ipcRenderer.invoke('openImportDialog');
        if (dialogResult.canceled || !dialogResult.filePaths?.length) {
            Toast.fire({ icon: 'info', title: translate('toastImportCancelled') });
            return;
        }
        const filePath = dialogResult.filePaths[0];
        const fileName = filePath.split(/[\\/]/).pop();

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
             customClass: {
                 popup: 'swal2-popup import-mode-popup choice-popup',
                 radio: 'swal2-radio',
                 label: 'swal2-radio-label',
             },
             confirmButtonText: translate('swalImportModeNext'),
             cancelButtonText: translate('swalCancelButton'),
             showCancelButton: true,
             // --- THIS IS THE FIX: Disabled automatic focus ---
             focusConfirm: false,
         });

        if (importMode) {
            const confirmTextKey = importMode === 'overwrite' ? 'swalImportConfirmOverwrite' : 'swalImportConfirmMerge';
            const confirmButtonText = translate(importMode === 'overwrite' ? 'swalImportConfirmButtonOverwrite' : 'swalImportConfirmButtonMerge');

            Swal.fire({
                title: translate('swalImportConfirmTitle'),
                text: translate(confirmTextKey),
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: confirmButtonText,
                cancelButtonText: translate('swalCancelButton'),
                customClass: { 
                    popup: 'swal2-popup import-final-confirm-popup' 
                },
                // --- THIS IS THE FIX: Disabled automatic focus ---
                focusConfirm: false,
            }).then(async (confirmationResult) => {
                if (confirmationResult.isConfirmed) {
                    const button = elements.importButton;
                    const otherButtons = [elements.exportButton, elements.clearDataButton];
                    try {
                        button.disabled = true;
                        otherButtons.forEach(b => b.disabled = true);
                        const processingToast = Toast.fire({ icon: 'info', title: translate('toastImporting'), timer: null, showConfirmButton: false, timerProgressBar: false });

                        const importResult = await ipcRenderer.invoke('importData', filePath, importMode);

                        processingToast.close();

                        if (importResult.success) {
                            Toast.fire({ icon: 'success', title: translate('toastImportSuccess', { count: importResult.count }) });
                            state.setCurrentStatusFilter('All');
                            state.setCurrentTypeFilter('All');
                            const typeSelect = document.getElementById('type-filter-select');
                            if(typeSelect) typeSelect.value = 'All';
                            const currentLoadCards = state.getLoadCardsFunction?.();
                            if(currentLoadCards) setTimeout(() => currentLoadCards(), 0);
                        } else {
                            const errorMsg = translate(importResult.error, { fallback: importResult.error || 'toastImportError' });
                            Swal.fire({ title: translate('swalImportErrorTitle'), text: errorMsg, icon: 'error', customClass: { popup: 'swal2-popup' } });
                        }
                    } catch (error) {
                        console.error("Import IPC Error:", error);
                        const errorMsg = translate('swalImportErrorIPCText');
                        Swal.fire({ title: translate('swalImportErrorIPC'), text: errorMsg, icon: 'error', customClass: { popup: 'swal2-popup' } });
                        const pt = Swal.getToast(); if (pt) pt.close();
                    } finally {
                         button.disabled = false;
                         otherButtons.forEach(b => b.disabled = false);
                    }
                }
            });
        }
    });

    elements.exportButton?.addEventListener('click', async () => {
         const button = elements.exportButton;
         const otherButtons = [elements.importButton, elements.clearDataButton];
         try {
             button.disabled = true;
             otherButtons.forEach(b => b.disabled = true);
             const result = await ipcRenderer.invoke('openExportDialog');
             if (result.success) {
                 setButtonSuccess(button, 'toastExportSuccess');
             } else if (!result.canceled) {
                 const errorMsg = translate(result.error, { fallback: result.error || 'toastExportError' });
                 setButtonError(button, errorMsg);
             } else {
                 Toast.fire({ icon: 'info', title: translate('toastExportCancelled') });
                 button.disabled = false;
             }
         } catch (error) {
             console.error("Export IPC Error:", error);
             const errorMsg = translate('toastErrorIPC');
             setButtonError(button, errorMsg);
         } finally {
             otherButtons.forEach(b => b.disabled = false);
         }
     });

    elements.clearDataButton?.addEventListener('click', () => {
         Swal.fire({
             title: translate('swalClearConfirmTitle'),
             html: translate('swalClearConfirmHtml'),
             icon: 'warning',
             showCancelButton: true,
             confirmButtonText: translate('swalClearConfirmButton'),
             cancelButtonText: translate('swalCancelButton'),
             customClass: { popup: 'swal2-popup clear-data-popup' },
             // --- THIS IS THE FIX: Disabled automatic focus ---
             focusConfirm: false,
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
                         state.setCurrentStatusFilter('All');
                         state.setCurrentTypeFilter('All');
                         const typeSelect = document.getElementById('type-filter-select');
                         if(typeSelect) typeSelect.value = 'All';
                         const currentLoadCards = state.getLoadCardsFunction?.();
                         if(currentLoadCards) setTimeout(() => currentLoadCards(), 0);
                     } else {
                         const errorMsg = translate(clearResult.error, { fallback: clearResult.error || 'toastClearError' });
                         setButtonError(button, errorMsg);
                     }
                 } catch (error) {
                     console.error("Clear Data IPC Error:", error);
                     const errorMsg = translate('toastErrorIPC');
                     setButtonError(button, errorMsg);
                     const pt = Swal.getToast(); if (pt) pt.close();
                 } finally {
                     if(!button.classList.contains('error')) button.disabled = false;
                     otherButtons.forEach(b => b.disabled = false);
                 }
             }
         });
     });
}

module.exports = { setupDialogs };