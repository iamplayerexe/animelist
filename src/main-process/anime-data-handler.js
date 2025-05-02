// <-- comment (.js file)(src/main-process/anime-data-handler.js)
const { ipcMain, dialog, net, app } = require('electron'); // Added app
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const { URL } = require('url');

// Ensure constants are loaded correctly relative to app path
let constants;
try {
    const constantsPath = path.join(app.getAppPath(), 'src', 'javascript', 'constants.js');
    if (fs.existsSync(constantsPath)) {
        constants = require(constantsPath);
        if (!constants.ALLOWED_SEASON_TYPES || !constants.DEFAULT_SEASON_TYPE || !constants.DEFAULT_IMAGE) {
            throw new Error("Required constants (ALLOWED_SEASON_TYPES, DEFAULT_SEASON_TYPE, DEFAULT_IMAGE) not found in constants module.");
        }
    } else {
        throw new Error(`Constants file not found at: ${constantsPath}`);
    }
} catch(err) {
    console.error("CRITICAL ERROR loading constants:", err);
    // Provide hardcoded fallbacks ONLY if loading fails completely
    constants = {
        ALLOWED_SEASON_TYPES: ['Season', 'OVA', 'Movie', 'Special', 'Scan', 'Non-Canon'],
        DEFAULT_SEASON_TYPE: 'Season',
        DEFAULT_IMAGE: './assets/default-avatar.png', // Relative path might be problematic here if appPath isn't set correctly early on
        STATUS_OPTIONS: ['Plan to Watch', 'Watching', 'Completed', 'On Hold', 'Dropped'],
        DEFAULT_STATUS: 'Plan to Watch'
    };
    console.warn("Using hardcoded fallback constants.");
}

const { ALLOWED_SEASON_TYPES, DEFAULT_SEASON_TYPE, DEFAULT_IMAGE } = constants;

// --- Stores Initialization ---
const animeStore = new Store({ name: 'animes', defaults: { animes: [] } });
const settingsStore = new Store({ name: 'settings', defaults: { selectedLanguage: 'en' } });

console.log("Data Handler: Stores initialized.");
console.log("Data Handler: Anime store path:", animeStore.path);
console.log("Data Handler: Settings store path:", settingsStore.path);

// --- Constants needed within this module ---
const DEFAULT_IMAGE_PATH = path.join(app.getAppPath(), 'src', DEFAULT_IMAGE); // Use constant from require
const ALLOWED_STATUSES = constants.STATUS_OPTIONS || ['Plan to Watch', 'Watching', 'Completed', 'On Hold', 'Dropped']; // Use from constants or fallback
const DEFAULT_STATUS = constants.DEFAULT_STATUS || 'Plan to Watch'; // Use from constants or fallback

// --- Jikan API Interaction ---
const JIKAN_API_BASE = 'https://api.jikan.moe/v4';
let lastApiCallTime = 0;
const API_CALL_DELAY = 500; // ms delay between Jikan calls

function makeJikanRequest(url) {
    return new Promise((resolve, reject) => {
        console.log(`[net] Making request to: ${url}`);
        try {
            const requestUrl = new URL(url);
            // Use Electron's net module for requests
            const request = net.request({
                method: 'GET',
                protocol: requestUrl.protocol,
                hostname: requestUrl.hostname,
                path: requestUrl.pathname + requestUrl.search,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': `AnimeListApp/${app.getVersion()} (Electron)` // Use app version
                }
            });

            let responseBody = '';
            request.on('response', (response) => {
                console.log(`[net] STATUS: ${response.statusCode} for ${url}`);
                // Handle redirects if necessary (though Jikan v4 typically doesn't redirect like this)
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    console.warn(`[net] Redirect detected to: ${response.headers.location}. Following not implemented.`);
                    reject(new Error(`Redirect detected (status ${response.statusCode}) - not handled.`));
                    return;
                }

                response.on('data', (chunk) => { responseBody += chunk; });
                response.on('end', () => {
                    console.log('[net] Response end.');
                    if (response.statusCode >= 200 && response.statusCode < 300) {
                        try {
                            resolve({ success: true, data: JSON.parse(responseBody) });
                        } catch (parseError) {
                            console.error(`[net] JSON Parse Error for ${url}:`, parseError);
                            reject(new Error(`Failed to parse JSON: ${parseError.message}`));
                        }
                    } else if (response.statusCode === 429) {
                        console.warn(`[net] Rate limited (429) for ${url}.`);
                        reject(new Error(`Rate limited (429)`)); // Specific error for rate limit
                    } else {
                         console.error(`[net] Request failed for ${url}. Status: ${response.statusCode}. Body: ${responseBody.slice(0, 200)}...`);
                         reject(new Error(`Request failed: ${response.statusCode}`));
                    }
                });
                response.on('error', (error) => {
                    console.error(`[net] Response stream error for ${url}:`, error);
                    reject(new Error(`Response stream error: ${error.message}`));
                });
            });
            request.on('error', (error) => {
                 console.error(`[net] Request error for ${url}:`, error);
                 reject(new Error(`Request error: ${error.message}`));
             });
            request.end(); // Send the request
        } catch (urlError) {
            console.error(`[net] Invalid URL Error: ${urlError.message}`);
            reject(new Error(`Invalid URL: ${urlError.message}`));
        }
    });
}

async function searchAnimeImage(title, seasonNumber = null) {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCallTime;

    // Enforce delay between calls
    if (timeSinceLastCall < API_CALL_DELAY) {
        const delayNeeded = API_CALL_DELAY - timeSinceLastCall;
        console.log(`Jikan Delay: Waiting ${delayNeeded}ms before search for "${title}"`);
        await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }
    lastApiCallTime = Date.now(); // Update timestamp *before* making the call

    // Prepare search terms (clean up common season indicators)
    const baseTitle = title.replace(/season \d+/i, '').replace(/ S\d+/i, '').replace(/\d+(st|nd|rd|th) season/i, '').trim();
    const seasonNum = parseInt(seasonNumber, 10);
    const useSeasonNumber = !isNaN(seasonNum) && seasonNum > 0;

    // Construct potential search queries
    const primarySearchQuery = useSeasonNumber ? `${baseTitle} S${seasonNum}` : baseTitle;
    const specificSearchQuery = useSeasonNumber ? `${baseTitle} season ${seasonNum}` : null;
    const baseTitleQuery = (useSeasonNumber && primarySearchQuery !== baseTitle) ? baseTitle : null;

    if (!baseTitle) return null; // Can't search without a title

    // Helper to execute a single search attempt
    const executeSearch = async (searchTerm) => {
        if (!searchTerm) return null;

        // Re-check delay before *each* actual request within this function call if multiple searches happen
        const currentNow = Date.now();
        const timeSinceLast = currentNow - lastApiCallTime;
        if (timeSinceLast < API_CALL_DELAY) {
             const delayNeeded = API_CALL_DELAY - timeSinceLast;
             console.log(`Jikan Delay (Internal): Waiting ${delayNeeded}ms before searching "${searchTerm}"`);
             await new Promise(resolve => setTimeout(resolve, delayNeeded));
        }
        lastApiCallTime = Date.now(); // Update time before request

        const query = encodeURIComponent(searchTerm);
        const url = `${JIKAN_API_BASE}/anime?q=${query}&limit=5&type=tv&sfw`; // Limit search slightly, focus on TV
        console.log(`Searching Jikan for: "${searchTerm}" (URL: ${url})`);

        try {
            const result = await makeJikanRequest(url);
            if (result.success && result.data?.data?.length > 0) {
                // Try to find a good match
                const exactMatch = result.data.data.find(item => item.title?.toLowerCase() === searchTerm.toLowerCase());
                if (exactMatch) return exactMatch.images?.jpg?.large_image_url || exactMatch.images?.jpg?.image_url;

                const partialMatch = result.data.data.find(item => item.title?.toLowerCase().includes(baseTitle.toLowerCase()));
                if (partialMatch) return partialMatch.images?.jpg?.large_image_url || partialMatch.images?.jpg?.image_url;

                // Fallback to first result if no better match found
                return result.data.data[0]?.images?.jpg?.large_image_url || result.data.data[0]?.images?.jpg?.image_url;
            }
        } catch (error) {
            console.error(`Jikan search attempt error for "${searchTerm}":`, error.message);
            if (error.message.includes('429')) { // If rate limited, wait longer before next potential attempt
                console.warn("Jikan Rate Limited. Increasing delay for next potential call.");
                await new Promise(resolve => setTimeout(resolve, API_CALL_DELAY * 2)); // Longer wait
                lastApiCallTime = Date.now(); // Reset timer after extra delay
            }
            // Don't re-throw, just return null for this attempt
        }
        return null; // Return null if search failed or no results
    };

    // --- Attempt searches in order of specificity ---
    let foundImage = await executeSearch(primarySearchQuery); // Try "Title S1" or "Title"
    if (foundImage) return foundImage;

    if (specificSearchQuery) { // Try "Title season 1"
        foundImage = await executeSearch(specificSearchQuery);
        if (foundImage) return foundImage;
    }

    if (baseTitleQuery) { // If season search failed, try just "Title"
        foundImage = await executeSearch(baseTitleQuery);
        if (foundImage) return foundImage;
    }

    console.log(`Image search failed for: "${title}" (Season: ${seasonNumber})`);
    return null; // Return null if all attempts fail
}


// --- Data Integrity ---
const runIntegrityCheck = (animesList) => {
    let changed = false;
    if (!Array.isArray(animesList)) return { checkedAnimes: [], changed: true }; // Treat invalid input as changed
    const checkedAnimes = animesList.map(anime => {
        if (!anime || typeof anime.id === 'undefined' || typeof anime.name === 'undefined') {
            console.warn("Integrity Check: Removed invalid anime entry:", anime);
            changed = true;
            return null; // Filter out invalid entries
        }

        let animeChanged = false;
        const initialAnimeString = JSON.stringify(anime); // For comparison

        // Ensure required fields exist and have correct types
        if (typeof anime.name !== 'string') { anime.name = String(anime.name || 'Unknown'); animeChanged = true; }
        if (!anime.name.trim()) { anime.name = 'Unknown'; animeChanged = true; } // Handle empty names
        if (!anime.seasonType || !ALLOWED_SEASON_TYPES.includes(anime.seasonType)) { anime.seasonType = DEFAULT_SEASON_TYPE; animeChanged = true; }
        if (typeof anime.totalEpisodes !== 'number' || isNaN(anime.totalEpisodes) || anime.totalEpisodes < 0) { anime.totalEpisodes = 0; animeChanged = true; }
        if (typeof anime.watchedEpisodes !== 'number' || isNaN(anime.watchedEpisodes) || anime.watchedEpisodes < 0) { anime.watchedEpisodes = 0; animeChanged = true; }
        if (!anime.status || !ALLOWED_STATUSES.includes(anime.status)) { anime.status = DEFAULT_STATUS; animeChanged = true; }
        if (typeof anime.image !== 'string') { anime.image = DEFAULT_IMAGE_PATH; animeChanged = true; }
        if (!anime.image.trim()) { anime.image = DEFAULT_IMAGE_PATH; animeChanged = true; }
        if (typeof anime.id !== 'string') { anime.id = String(anime.id); animeChanged = true; }

        // Validate Season Number based on Type
        let currentSeasonNumber = anime.seasonNumber; // Keep original type (could be null, undefined, string, number)
        if (anime.seasonType === 'Season') {
             const parsedNum = parseInt(currentSeasonNumber, 10);
             if (isNaN(parsedNum) || parsedNum < 1) { // Seasons must be 1 or higher
                 anime.seasonNumber = 1; animeChanged = true;
             } else {
                 anime.seasonNumber = parsedNum; // Ensure it's stored as a number
             }
        } else { // For non-Season types, allow 0 or null/undefined
             if (currentSeasonNumber === null || currentSeasonNumber === undefined) {
                 if (anime.seasonNumber !== null) { // If it was undefined, make it explicitly null
                     anime.seasonNumber = null;
                     // Don't mark as changed if it was already effectively null/undefined
                 }
             } else {
                 const parsedNum = parseInt(currentSeasonNumber, 10);
                 if (isNaN(parsedNum) || parsedNum < 0) { // Allow 0 for non-seasons
                     anime.seasonNumber = null; animeChanged = true; // Invalid number becomes null
                 } else {
                     anime.seasonNumber = parsedNum; // Ensure it's stored as a number
                 }
             }
        }
        // Ensure seasonNumber is either a number or null
        if (typeof anime.seasonNumber !== 'number' && anime.seasonNumber !== null) {
             anime.seasonNumber = null; animeChanged = true;
        }


        // Correct image path if it's not a URL and not the default path
        if (typeof anime.image === 'string' && !anime.image.startsWith('http') && !anime.image.startsWith('file:') && anime.image !== DEFAULT_IMAGE_PATH) {
             anime.image = DEFAULT_IMAGE_PATH; animeChanged = true;
        }

        // Adjust totals/watched for Movies specifically
        if (anime.seasonType === 'Movie') {
            if (anime.totalEpisodes !== 1) { anime.totalEpisodes = 1; animeChanged = true; }
            if (anime.watchedEpisodes > 1) { anime.watchedEpisodes = 1; animeChanged = true; }
        }

        // Cap watched episodes at total episodes (for non-movies too)
        if (anime.totalEpisodes >= 0 && anime.watchedEpisodes > anime.totalEpisodes) {
            anime.watchedEpisodes = anime.totalEpisodes; animeChanged = true;
        }

        // Adjust status based on watched/total (more robust checks)
        const currentStatus = anime.status;
        const watched = anime.watchedEpisodes;
        const total = anime.totalEpisodes;

        // Handle completion status
        if (total > 0 && watched === total && currentStatus !== 'Completed') {
            anime.status = 'Completed'; animeChanged = true;
        } else if (watched < total && currentStatus === 'Completed') {
            // If manually set completed but not finished, revert to Watching
            anime.status = 'Watching'; animeChanged = true;
        }
        // Handle transition from Plan to Watch
        else if (watched > 0 && currentStatus === 'Plan to Watch') {
            anime.status = 'Watching'; animeChanged = true;
        }
        // Handle reset to Plan to Watch if episodes become 0
        else if (watched === 0 && (currentStatus === 'Watching' || currentStatus === 'On Hold')) {
            anime.status = 'Plan to Watch'; animeChanged = true;
        }

        // Log if changes were made
        if (animeChanged) {
            console.log(`Integrity Check Modified: ${anime.name} (ID: ${anime.id})`);
            console.log(`   Before: ${initialAnimeString}`);
            console.log(`   After : ${JSON.stringify(anime)}`);
            changed = true; // Mark overall change
        }
        return anime;
    }).filter(anime => anime !== null); // Remove entries that were completely invalid

    return { checkedAnimes, changed };
};

const updateAnimesIntegrity = () => {
    try {
        let currentAnimes = animeStore.get('animes');
        // Handle case where store might contain non-array data
        if (!Array.isArray(currentAnimes)) {
            console.warn("Anime data in store is not an array. Resetting to empty.");
            currentAnimes = [];
        }
        const { checkedAnimes, changed } = runIntegrityCheck(currentAnimes);
        if (changed) {
            console.log("Updating anime data store due to integrity check changes.");
            animeStore.set('animes', checkedAnimes);
        } else {
            console.log("Integrity check passed. No changes needed.");
        }
    } catch (error) {
        console.error("Error during integrity check:", error);
    }
};


// --- File I/O ---
const readImportFile = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) return { success: false, error: 'File not found.' };
        const data = fs.readFileSync(filePath, 'utf-8');
        if (!data.trim()) return { success: false, error: 'File is empty.' };
        const content = JSON.parse(data);
        // Ensure the root is an array
        if (!Array.isArray(content)) return { success: false, error: 'Imported file does not contain a valid JSON array.' };
        return { success: true, data: content };
    } catch (error) {
        console.error(`Error reading/parsing import file ${filePath}:`, error.message);
        // Provide more specific error info if possible
        const errorReason = error instanceof SyntaxError ? 'Invalid JSON format' : error.message;
        return { success: false, error: `Error reading import file: ${errorReason}` };
    }
};
const writeExportFile = (dataToWrite, filePath) => {
    try {
        const dir = path.dirname(filePath);
        // Ensure directory exists before writing
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(dataToWrite, null, 2), 'utf-8'); // Pretty print JSON
        console.log(`Successfully wrote export data to ${path.basename(filePath)}`);
        return { success: true };
    } catch (error) {
        console.error(`Error writing export file ${filePath}:`, error.message);
        return { success: false, error: `File write error (${path.basename(filePath)}): ${error.message}` };
    }
};


// --- Initialization Function ---
function initializeDataHandlers(mainWindowRef) {
    console.log("Initializing Data Handlers...");
    updateAnimesIntegrity(); // Run check on startup

    // --- Register IPC Handlers ---
    ipcMain.handle('getAnimes', async () => {
        console.log('[IPC getAnimes] Handler invoked.');
        try {
            const animes = animeStore.get('animes');
            console.log(`[IPC getAnimes] Read from store. Type: ${typeof animes}, IsArray: ${Array.isArray(animes)}, Length: ${Array.isArray(animes) ? animes.length : 'N/A'}`);
            // Ensure an array is always returned
            if (!Array.isArray(animes)) {
                console.warn('[IPC getAnimes] Data from store is not an array, returning empty array.');
                return [];
            }
            return animes;
        } catch (error) {
            console.error("[IPC getAnimes] Error getting animes:", error);
            return []; // Return empty array on error
        }
    });

    ipcMain.handle('addAnimeEntry', async (event, animeData) => {
        console.log('[IPC addAnimeEntry] Received:', animeData);
        // Basic validation
        if (!animeData?.name?.trim() || !animeData.seasonType || !ALLOWED_SEASON_TYPES.includes(animeData.seasonType) || typeof animeData.totalEpisodes === 'undefined') {
            console.error('[IPC addAnimeEntry] Invalid input data.'); return { success: false, error: 'Invalid input data.' };
        }

        let seasonNumber = null;
        let totalEpisodes = parseInt(animeData.totalEpisodes, 10);

        // Validate season number based on type
        if (animeData.seasonType === 'Season') {
            const p = parseInt(animeData.seasonNumber, 10);
            if (isNaN(p) || p < 1) { console.error('[IPC addAnimeEntry] Invalid Season number.'); return { success: false, error: 'swalValidationSeasonNumber' }; }
            seasonNumber = p;
        } else if (animeData.seasonNumber !== null && animeData.seasonNumber !== undefined && String(animeData.seasonNumber).trim() !== '') {
            const p = parseInt(animeData.seasonNumber, 10);
            if (isNaN(p) || p < 0) { console.error('[IPC addAnimeEntry] Invalid non-Season number.'); return { success: false, error: 'Invalid number.' }; }
            seasonNumber = p;
        } // else: seasonNumber remains null if not provided/invalid for non-Season types

        // Validate total episodes
        if (isNaN(totalEpisodes) || totalEpisodes < 0) { console.error('[IPC addAnimeEntry] Invalid total episodes.'); return { success: false, error: 'Invalid total episodes.' }; }
        if (animeData.seasonType === 'Movie') { totalEpisodes = 1; } // Force 1 for movies


        try {
            let animes = animeStore.get('animes');
            if (!Array.isArray(animes)) animes = []; // Initialize if store is empty/corrupt

            const newId = `anime_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`; // More unique ID
            const animeName = animeData.name.trim();

            // --- Image handling: Prioritize provided URL, then search, then default ---
            let finalImageUrl = DEFAULT_IMAGE_PATH; // Start with default
            const providedImageUrl = animeData.image?.trim();

            // 1. Use provided image if it's a valid URL
            if (providedImageUrl && providedImageUrl.startsWith('http')) {
                console.log(`[IPC addAnimeEntry] Using provided image URL: ${providedImageUrl}`);
                finalImageUrl = providedImageUrl;
            } else {
                // 2. If no valid provided image, try Jikan search
                console.log(`[IPC addAnimeEntry] No valid image provided or not a URL, searching Jikan...`);
                try {
                    // Pass the correct season number for the search if type is Season
                    const searchSN = (animeData.seasonType === 'Season' && seasonNumber !== null) ? seasonNumber : null;
                    const foundImage = await searchAnimeImage(animeName, searchSN);
                    if (foundImage) {
                        console.log(`[IPC addAnimeEntry] Found image via Jikan: ${foundImage}`);
                        finalImageUrl = foundImage;
                    } else {
                        console.log(`[IPC addAnimeEntry] Jikan search failed or returned no image, using default image.`);
                    }
                } catch (searchError) {
                    console.error(`[IPC addAnimeEntry] Jikan search error:`, searchError);
                    // Proceed with default image on search error
                }
            }
            // 3. finalImageUrl is now either provided, found, or default

            // Construct the final anime object
            const newAnime = {
                id: newId,
                name: animeName,
                image: finalImageUrl,
                seasonType: animeData.seasonType,
                seasonNumber: seasonNumber, // Use validated number (can be null)
                totalEpisodes: totalEpisodes, // Use validated total
                watchedEpisodes: 0, // Start at 0
                status: DEFAULT_STATUS // Start with default status
            };

            // Check for duplicates based on name, type, and number (case-insensitive name)
             const exists = animes.some(a =>
                 a?.name?.toLowerCase() === newAnime.name.toLowerCase() &&
                 a.seasonType === newAnime.seasonType &&
                 a.seasonNumber === newAnime.seasonNumber // Strict comparison handles null correctly
             );

            if (exists) {
                 const duplicateIdentifier = `${newAnime.name} (${newAnime.seasonType}${newAnime.seasonNumber !== null ? ' '+newAnime.seasonNumber : ''})`;
                 console.warn(`[IPC addAnimeEntry] Duplicate found: ${duplicateIdentifier}`);
                 return { success: false, error: `"${duplicateIdentifier}" already exists.` };
            }

            animes.push(newAnime); // Add the new anime
            animeStore.set('animes', animes); // Save the updated list
            console.log(`[IPC addAnimeEntry] Anime added successfully: ${newAnime.name} (ID: ${newId})`);
            return { success: true, animeInfo: newAnime }; // Return success and the added anime info

        } catch (error) {
            console.error("[IPC addAnimeEntry] Error adding anime:", error);
            return { success: false, error: `Error saving: ${error.message}` };
        }
    });

    // --- Other IPC Handlers ---
    ipcMain.handle('updateWatchedEpisodes', async (event, animeId, newWatchedCount) => {
        if (animeId === undefined || newWatchedCount === undefined) return { success: false, error: 'Missing data.' };
        try {
            let animes = animeStore.get('animes');
            if (!Array.isArray(animes)) return { success: false, error: 'No data.' };
            const idx = animes.findIndex(a => a.id === animeId);
            if (idx === -1) return { success: false, error: 'Not found.' };

            const anime = { ...animes[idx] }; // Work on a copy
            const origS = anime.status || DEFAULT_STATUS;
            const origW = anime.watchedEpisodes ?? 0;
            const totalE = anime.totalEpisodes ?? 0;
            // Determine max watched based on type
            const maxW = (anime.seasonType === 'Movie') ? 1 : totalE;

            const valC = parseInt(newWatchedCount, 10);
            let finalC = origW; // Default to original if parse fails

            if (!isNaN(valC)) { // Ensure parsed value is a number
                finalC = Math.max(0, Math.min(valC, maxW)); // Clamp value between 0 and max
            } else {
                return { success: false, error: 'Invalid count.' };
            }

            const countCh = origW !== finalC; // Was the count actually changed?
            let statusCh = false; // Did the status change?

            // Update status logic based on count change
            if (countCh) {
                if (finalC === totalE && totalE > 0 && origS !== 'Completed') { // Completed
                    anime.status = 'Completed'; statusCh = true;
                } else if (finalC < totalE && origS === 'Completed') { // Reverted from completed
                    anime.status = 'Watching'; statusCh = true;
                } else if (finalC > 0 && origS === 'Plan to Watch') { // Started watching
                    anime.status = 'Watching'; statusCh = true;
                } else if (anime.seasonType === 'Movie') { // Movie specific logic
                    if (finalC === 1 && origS !== 'Completed') { anime.status = 'Completed'; statusCh = true; }
                    else if (finalC === 0 && origW === 1 && origS === 'Completed') { anime.status = 'Watching'; statusCh = true; } // Unwatched a completed movie
                }
            }

            anime.watchedEpisodes = finalC; // Apply the validated watched count

            // If count or status changed, save and return updated anime
            if (countCh || statusCh) {
                animes[idx] = anime; // Update the array
                animeStore.set('animes', animes); // Save to store
                console.log(`Updated eps/status: ${anime.name} (ID: ${animeId}) - Watched: ${finalC}, Status: ${anime.status}`);
                return { success: true, updatedAnime: anime };
            } else {
                // No change occurred, return current state
                return { success: true, updatedAnime: animes[idx] };
            }
        } catch (error) {
            console.error("Error updating watched episodes:", error);
            return { success: false, error: `Save error: ${error.message}` };
        }
    });

    ipcMain.handle('updateTotalEpisodes', async (event, animeId, newTotalCount) => {
        if (typeof animeId === 'undefined' || typeof newTotalCount === 'undefined') return { success: false, error: 'Missing data for total episode update.' };

        const totalEpisodes = parseInt(newTotalCount, 10);
        if (isNaN(totalEpisodes) || totalEpisodes < 0) return { success: false, error: 'Invalid total episode count provided (must be >= 0).' };

        try {
            let animes = animeStore.get('animes');
            if (!Array.isArray(animes)) return { success: false, error: 'Could not read anime data.' };
            const idx = animes.findIndex(a => a.id === animeId);
            if (idx === -1) return { success: false, error: 'Anime not found.' };

            const anime = { ...animes[idx] }; // Work on copy
            const origTot = anime.totalEpisodes ?? 0;
            const origWat = anime.watchedEpisodes ?? 0;
            let watchCh = false; // Did watched episodes change?
            let statusCh = false; // Did status change?

            // Cannot change total for Movie type
            if (anime.seasonType === 'Movie') {
                return { success: false, error: 'Cannot change total episodes for Movie type.' };
            }

            const totalCh = origTot !== totalEpisodes; // Did total actually change?

            if (totalCh) {
                anime.totalEpisodes = totalEpisodes; // Update total
                // If watched exceeds new total, cap it
                if (origWat > totalEpisodes) {
                    anime.watchedEpisodes = totalEpisodes; watchCh = true;
                }

                // Check if status needs update based on new total
                const curStat = anime.status || DEFAULT_STATUS;
                const curWat = anime.watchedEpisodes; // Use potentially capped watched value
                if (totalEpisodes > 0 && curWat === totalEpisodes && curStat !== 'Completed') {
                    anime.status = 'Completed'; statusCh = true; // Auto-complete if now finished
                } else if (curWat < totalEpisodes && curStat === 'Completed') {
                    anime.status = 'Watching'; statusCh = true; // Revert status if no longer finished
                }
            }

            // If total, watched, or status changed, save and return
            if (totalCh || watchCh || statusCh) {
                animes[idx] = anime;
                animeStore.set('animes', animes);
                console.log(`Updated total episodes for ${anime.name} (ID: ${animeId}) - Total: ${totalEpisodes}, Watched: ${anime.watchedEpisodes}, Status: ${anime.status}`);
                return { success: true, updatedAnime: anime };
            } else {
                // No effective change, return current state
                return { success: true, updatedAnime: animes[idx] };
            }
        } catch (error) {
            console.error("Error updating total episodes:", error);
            return { success: false, error: `Save error: ${error.message}` };
        }
    });

    ipcMain.handle('updateAnimeStatus', async (event, animeId, newStatus) => {
        if (!animeId || !newStatus || !ALLOWED_STATUSES.includes(newStatus)) return { success: false, error: "Invalid data." };
        try {
            let animes = animeStore.get('animes');
            if (!Array.isArray(animes)) return { success: false, error: 'No data.' };
            const idx = animes.findIndex(a => a.id === animeId);
            if (idx === -1) return { success: false, error: 'Not found.' };

            const anime = { ...animes[idx] }; // Work on copy
            const origS = anime.status;
            let epsCh = false; // Did watched episodes change due to status change?

            // Auto-adjust watched episodes based on new status if logical
            if (newStatus === 'Completed' && anime.watchedEpisodes !== anime.totalEpisodes) {
                 if (anime.seasonType === 'Movie' && anime.watchedEpisodes !== 1) { anime.watchedEpisodes = 1; epsCh = true; }
                 else if (anime.seasonType !== 'Movie') { anime.watchedEpisodes = anime.totalEpisodes ?? 0; epsCh = true; }
            } else if (newStatus === 'Plan to Watch' && anime.watchedEpisodes !== 0) {
                 anime.watchedEpisodes = 0; epsCh = true;
            }
            // Note: Setting to 'Watching' doesn't automatically change episode count here

            const statusCh = origS !== newStatus; // Did status actually change?
            if (statusCh) anime.status = newStatus; // Apply new status

            // If status or episodes changed, save and return
            if (statusCh || epsCh) {
                animes[idx] = anime;
                animeStore.set('animes', animes);
                console.log(`Updated status/eps for ${anime.name} (ID: ${animeId}) - Status: ${newStatus}, Watched: ${anime.watchedEpisodes}`);
                return { success: true, updatedAnime: anime };
            } else {
                // No change occurred
                return { success: true, updatedAnime: animes[idx] };
            }
        } catch (error) {
            console.error("Error updating status:", error);
            return { success: false, error: `Save error: ${error.message}` };
        }
    });

    ipcMain.handle('deleteAnime', async (event, animeId) => {
        if (!animeId) return { success: false, error: 'Missing ID.' };
        try {
            let animes = animeStore.get('animes');
            if (!Array.isArray(animes)) return { success: false, error: 'No data.' };
            const initialLength = animes.length;
            const updatedAnimes = animes.filter(a => a.id !== animeId); // Filter out the anime
            // Check if any anime was actually removed
            if (updatedAnimes.length === initialLength) {
                 return { success: false, error: 'Anime not found.' };
            }
            animeStore.set('animes', updatedAnimes); // Save the filtered list
            console.log(`Deleted anime ID: ${animeId}`);
            return { success: true };
        } catch (error) {
            console.error("Error deleting anime:", error);
            return { success: false, error: `Save error: ${error.message}` };
        }
    });

    ipcMain.handle('openImportDialog', async () => {
        if (!mainWindowRef) return { canceled: true, filePaths: [] };
        try {
            const result = await dialog.showOpenDialog(mainWindowRef, {
                title: 'Import JSON',
                properties: ['openFile'],
                filters: [{ name: 'JSON Files', extensions: ['json'] }]
            });
            return { canceled: result.canceled, filePaths: result.filePaths };
        } catch (error) {
             console.error("Error showing import dialog:", error);
             return { canceled: true, filePaths: [] };
        }
    });

    ipcMain.handle('openExportDialog', async () => {
        if (!mainWindowRef) return { success: false, canceled: true };
        try {
            const result = await dialog.showSaveDialog(mainWindowRef, {
                title: 'Export Anime List',
                defaultPath: 'animes-export.json',
                filters: [{ name: 'JSON Files', extensions: ['json'] }]
            });
            if (result.canceled || !result.filePath) {
                return { success: false, canceled: true };
            }
            // Proceed with writing the file
            const currentAnimes = animeStore.get('animes');
            if (!Array.isArray(currentAnimes)) { throw new Error('Could not read data from store for export.'); }
            const writeResult = writeExportFile(currentAnimes, result.filePath);
            return writeResult; // Return {success: true} or {success: false, error: ...}
        } catch (error) {
            console.error("Error during export process:", error);
            return { success: false, canceled: false, error: `Export error: ${error.message}` };
        }
    });

    ipcMain.handle('importData', async (event, sourceFilePath, mode) => {
        if (!sourceFilePath || !mode || (mode !== 'overwrite' && mode !== 'merge')) {
            return { success: false, error: 'Missing file path or invalid import mode.' };
        }

        let processedCount = 0; // Count affected/added entries
        let finalAnimes = [];

        try {
            // 1. Read and Parse File
            const readResult = readImportFile(sourceFilePath);
            if (!readResult.success) throw new Error(readResult.error); // Propagate read error
            let importedAnimes = readResult.data;

            // 2. Run Integrity Check on IMPORTED data first
            console.log(`Running integrity check on ${importedAnimes.length} imported entries...`);
            const checkedImport = runIntegrityCheck(importedAnimes);
            if (checkedImport.changed) {
                console.warn("Integrity check modified imported data before processing.");
            }
            importedAnimes = checkedImport.checkedAnimes; // Use the checked/cleaned data
            console.log(`${importedAnimes.length} valid entries remaining after import check.`);

            // 3. Get Current Data
            let currentAnimes = animeStore.get('animes');
            if (!Array.isArray(currentAnimes)) { currentAnimes = []; }

            // 4. Perform Overwrite or Merge
            if (mode === 'overwrite') {
                console.log("Import Mode: Overwrite");
                finalAnimes = importedAnimes;
                processedCount = importedAnimes.length; // All imported entries are considered processed
            } else { // mode === 'merge'
                console.log("Import Mode: Merge");
                finalAnimes = [...currentAnimes]; // Start with current data
                // Create a set of unique keys from CURRENT data for quick lookup
                // Key: name_type_number (lowercase name, null for number if applicable)
                const currentKeys = new Set(currentAnimes.map(a =>
                    `${a.name?.toLowerCase()}_${a.seasonType||DEFAULT_SEASON_TYPE}_${a.seasonNumber === undefined || a.seasonNumber === null ? 'null' : a.seasonNumber}`
                ));
                let addedCount = 0;
                for (const importedEntry of importedAnimes) {
                    // Construct the key for the imported entry
                     const impNum = importedEntry.seasonNumber === undefined || importedEntry.seasonNumber === null ? 'null' : importedEntry.seasonNumber;
                     const impKey = `${importedEntry.name?.toLowerCase()}_${importedEntry.seasonType}_${impNum}`;

                     // If the key doesn't exist in the current set, add it
                     if (!currentKeys.has(impKey)) {
                         finalAnimes.push(importedEntry);
                         currentKeys.add(impKey); // Add key to set to prevent duplicates within the import file itself
                         addedCount++;
                     } else {
                         console.log(`Skipping duplicate during merge: ${impKey}`);
                     }
                }
                processedCount = addedCount; // Only count the newly added entries
            }

            // 5. Run Final Integrity Check on the COMBINED/OVERWRITTEN list
            console.log(`Running final integrity check on ${finalAnimes.length} total entries before saving...`);
            const { checkedAnimes: finalCheckedAnimes } = runIntegrityCheck(finalAnimes);
            // Note: We don't necessarily need the 'changed' flag here, just save the checked result

            // 6. Save the final list
            animeStore.set('animes', finalCheckedAnimes);
            console.log(`Import successful. Mode: ${mode}. Processed/Added: ${processedCount} entries. Saved ${finalCheckedAnimes.length} total animes.`);
            return { success: true, count: processedCount }; // Return count based on mode logic

        } catch (error) {
            console.error("Error during import process:", error);
            return { success: false, error: `Import error: ${error.message}` };
        }
    });

    ipcMain.handle('clearData', async () => {
        try {
            animeStore.set('animes', []); // Set the 'animes' key to an empty array
            console.log("Cleared anime data.");
            return { success: true };
        } catch (error) {
            console.error("Error clearing data:", error);
            return { success: false, error: `Clear error: ${error.message}` };
        }
    });

    ipcMain.handle('getLanguagePreference', async () => {
        try {
            const lang = settingsStore.get('selectedLanguage');
            // Return 'en' if no preference is stored or if it's not a string
            return typeof lang === 'string' ? lang : 'en';
        } catch (error) {
            console.error("Error getting language preference:", error);
            return 'en'; // Fallback to English on error
        }
    });

    ipcMain.handle('saveLanguagePreference', async (event, langCode) => {
        try {
            if (typeof langCode === 'string' && langCode.length > 0) {
                settingsStore.set('selectedLanguage', langCode);
                console.log(`Saved language preference: ${langCode}`);
                return { success: true };
            } else {
                return { success: false, error: 'Invalid language code provided.' };
            }
        } catch (error) {
            console.error("Error saving language preference:", error);
            return { success: false, error: `Save error: ${error.message}` };
        }
    });

    console.log("Data Handlers Initialized.");
} // End initializeDataHandlers

module.exports = { initializeDataHandlers };
// <-- end comment (.js file)(src/main-process/anime-data-handler.js)