// src/javascript/handlers/loading-screen-handler.js
// Updated path to go up one level
const elements = require('../dom-elements');

function handleLoadingScreen() {
    console.log('handleLoadingScreen (Fly-in, Slide-out): Function called.');

    if (elements.loadingScreen) {
        console.log('handleLoadingScreen (Fly-in, Slide-out): Found loadingScreen element.');

        const loadingTextElement = elements.loadingScreen.querySelector('#loading-text');
        const letterSpans = loadingTextElement?.querySelectorAll('span'); // Get all spans

        if (!loadingTextElement || !letterSpans || letterSpans.length !== 5) { // Check for 5 letters
            console.error("handleLoadingScreen (Fly-in, Slide-out): CRITICAL - #loading-text or required 5 spans not found!");
            // Fallback: Just hide immediately
            elements.loadingScreen.style.transition = 'opacity 0.5s ease-out';
            elements.loadingScreen.classList.add('hidden');
            return;
        }

        // Calculate timeout delay based on CSS fly-in animation
        // Longest animation-delay (0.5s for 'i') + animation-duration (0.7s) = 1.2s
        const flyInEndTime = 1200; // ms
        // Get slide animation duration from CSS (must match!)
        const slideDuration = 600; // ms (0.6s)

        console.log(`handleLoadingScreen (Fly-in, Slide-out): Fly-in ends at ${flyInEndTime}ms. Slide duration: ${slideDuration}ms.`);

        // --- First Timeout: Start the Slide ---
        setTimeout(() => {
            console.log('handleLoadingScreen (Fly-in, Slide-out): Fly-in complete. Adding sliding classes.');

            // Add specific classes for sliding animation
            letterSpans[0]?.classList.add('sliding-right-far'); // A
            letterSpans[1]?.classList.add('sliding-right');     // n
            // letterSpans[2] is 'i', doesn't slide
            letterSpans[3]?.classList.add('sliding-left');      // m
            letterSpans[4]?.classList.add('sliding-left-far');  // e

            // --- Second Timeout: Hide the Screen ---
            // Hide after the slide animation has finished
            const hideScreenDelay = slideDuration + 100; // Add a tiny buffer

            setTimeout(() => {
                console.log('handleLoadingScreen (Fly-in, Slide-out): Slide animation should be complete. Adding .hidden class to screen.');
                 if (elements.loadingScreen) { // Check again
                    elements.loadingScreen.classList.add('hidden');

                    // Optional: Remove the loading screen element after fade
                    // setTimeout(() => {
                    //     if (elements.loadingScreen) elements.loadingScreen.remove();
                    // }, 800); // Wait for background fade

                 }
            }, hideScreenDelay);

        }, flyInEndTime);


    } else {
        console.error("handleLoadingScreen (Fly-in, Slide-out): CRITICAL - loadingScreen element not found initially.");
    }
}

module.exports = { handleLoadingScreen };