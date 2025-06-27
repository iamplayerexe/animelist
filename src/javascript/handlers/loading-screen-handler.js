// src/javascript/handlers/loading-screen-handler.js
const elements = require('../dom-elements');

function handleLoadingScreen() {
    console.log('handleLoadingScreen (Image-based): Function called.');
    const loadingScreen = document.getElementById('loading-screen');
    const sidebarToggle = document.getElementById('sidebar-toggle');

    if (loadingScreen) {
        if(sidebarToggle) sidebarToggle.style.visibility = 'hidden';

        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            
            loadingScreen.addEventListener('transitionend', () => {
                loadingScreen.style.display = 'none';
                if(sidebarToggle) sidebarToggle.style.visibility = 'visible';
            }, { once: true });
        }, 1500);
    } else {
        console.error("handleLoadingScreen: CRITICAL - loadingScreen element not found initially.");
        if(sidebarToggle) sidebarToggle.style.visibility = 'visible';
    }
}

module.exports = { handleLoadingScreen };