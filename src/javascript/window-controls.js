// src/javascript/window-controls.js
const { ipcRenderer } = require('electron');
const elements = require('./dom-elements');

function setupWindowControls() {
    elements.closeButton?.addEventListener('click', () => ipcRenderer.invoke('closeApp'));
    elements.minButton?.addEventListener('click', () => ipcRenderer.invoke('minimizeApp'));
    elements.maxButton?.addEventListener('click', () => {
        ipcRenderer.invoke('maximizeApp');
        document.body.classList.toggle("maximized");
    });
    elements.restoreButton?.addEventListener('click', () => {
        ipcRenderer.invoke('maximizeApp');
        document.body.classList.remove("maximized");
    });
}

module.exports = { setupWindowControls };