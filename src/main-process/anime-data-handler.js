// <-- comment (.js file)(src/main-process/anime-data-handler.js)
// src/main-process/anime-data-handler.js
const { ipcMain, dialog, net, app } = require('electron'); // 'app' is needed for getVersion()
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
        ALLOWED_SEASON_TYPES: ['Season', 'OAV', 'Movie', 'Special', 'Scan', 'Non-Canon'],
        DEFAULT_SEASON_TYPE: 'Season',
        DEFAULT_IMAGE: './assets/default-avatar.png',
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
const DEFAULT_IMAGE_PATH = path.join(app.getAppPath(), 'src', DEFAULT_IMAGE);
const ALLOWED_STATUSES = constants.STATUS_OPTIONS || ['Plan to Watch', 'Watching', 'Completed', 'On Hold', 'Dropped'];
const DEFAULT_STATUS = constants.DEFAULT_STATUS || 'Plan to Watch';

// --- Jikan API Interaction ---
const JIKAN_API_BASE = 'https://api.jikan.moe/v4';
let lastApiCallTime = 0;
const API_CALL_DELAY = 500;

function makeJikanRequest(url) {
    return new Promise((resolve, reject) => {
        console.log(`[net] Making request to: ${url}`);
        try {
            const requestUrl = new URL(url);
            const request = net.request({
                method: 'GET',
                protocol: requestUrl.protocol,
                hostname: requestUrl.hostname,
                path: requestUrl.pathname + requestUrl.search,
                headers: { 'Accept': 'application/json', 'User-Agent': `AnimeListApp/${app.getVersion()} (Electron)` }
            });
            let responseBody = '';
            request.on('response', (response) => {
                console.log(`[net] STATUS: ${response.statusCode} for ${url}`);
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    console.warn(`[net] Redirect detected to: ${response.headers.location}. Following not implemented.`);
                    reject(new Error(`Redirect detected (status ${response.statusCode}) - not handled.`)); return;
                }
                response.on('data', (chunk) => { responseBody += chunk; });
                response.on('end', () => {
                    console.log('[net] Response end.');
                    if (response.statusCode >= 200 && response.statusCode < 300) {
                        try { resolve({ success: true, data: JSON.parse(responseBody) }); }
                        catch (parseError) { console.error(`[net] JSON Parse Error for ${url}:`, parseError); reject(new Error(`Failed to parse JSON: ${parseError.message}`)); }
                    } else if (response.statusCode === 429) { console.warn(`[net] Rate limited (429) for ${url}.`); reject(new Error(`Rate limited (429)`)); }
                    else { console.error(`[net] Request failed for ${url}. Status: ${response.statusCode}. Body: ${responseBody.slice(0, 200)}...`); reject(new Error(`Request failed: ${response.statusCode}`)); }
                });
                response.on('error', (error) => { console.error(`[net] Response stream error for ${url}:`, error); reject(new Error(`Response stream error: ${error.message}`)); });
            });
            request.on('error', (error) => { console.error(`[net] Request error for ${url}:`, error); reject(new Error(`Request error: ${error.message}`)); });
            request.end();
        } catch (urlError) { console.error(`[net] Invalid URL Error: ${urlError.message}`); reject(new Error(`Invalid URL: ${urlError.message}`)); }
    });
}

async function searchAnimeImage(title, seasonNumber = null) {
    const now = Date.now(); const timeSinceLastCall = now - lastApiCallTime;
    if (timeSinceLastCall < API_CALL_DELAY) { const delayNeeded = API_CALL_DELAY - timeSinceLastCall; console.log(`Jikan Delay: Waiting ${delayNeeded}ms before search for "${title}"`); await new Promise(resolve => setTimeout(resolve, delayNeeded)); }
    lastApiCallTime = Date.now(); const baseTitle = title.replace(/season \d+/i, '').replace(/ S\d+/i, '').replace(/\d+(st|nd|rd|th) season/i, '').trim(); const seasonNum = parseInt(seasonNumber, 10); const useSeasonNumber = !isNaN(seasonNum) && seasonNum > 0; const primarySearchQuery = useSeasonNumber ? `${baseTitle} S${seasonNum}` : baseTitle; const specificSearchQuery = useSeasonNumber ? `${baseTitle} season ${seasonNum}` : null; const baseTitleQuery = (useSeasonNumber && primarySearchQuery !== baseTitle) ? baseTitle : null; if (!baseTitle) return null;
    const executeSearch = async (searchTerm) => {
        if (!searchTerm) return null; const currentNow = Date.now(); const timeSinceLast = currentNow - lastApiCallTime;
        if (timeSinceLast < API_CALL_DELAY) { const delayNeeded = API_CALL_DELAY - timeSinceLast; console.log(`Jikan Delay (Internal): Waiting ${delayNeeded}ms before searching "${searchTerm}"`); await new Promise(resolve => setTimeout(resolve, delayNeeded)); }
        lastApiCallTime = Date.now(); const query = encodeURIComponent(searchTerm); const url = `${JIKAN_API_BASE}/anime?q=${query}&limit=5&type=tv&sfw`; console.log(`Searching Jikan for: "${searchTerm}" (URL: ${url})`);
        try {
            const result = await makeJikanRequest(url);
            if (result.success && result.data?.data?.length > 0) { const exactMatch = result.data.data.find(item => item.title?.toLowerCase() === searchTerm.toLowerCase()); if (exactMatch) return exactMatch.images?.jpg?.large_image_url || exactMatch.images?.jpg?.image_url; const partialMatch = result.data.data.find(item => item.title?.toLowerCase().includes(baseTitle.toLowerCase())); if (partialMatch) return partialMatch.images?.jpg?.large_image_url || partialMatch.images?.jpg?.image_url; return result.data.data[0]?.images?.jpg?.large_image_url || result.data.data[0]?.images?.jpg?.image_url; }
        } catch (error) { console.error(`Jikan search attempt error for "${searchTerm}":`, error.message); if (error.message.includes('429')) { console.warn("Jikan Rate Limited. Increasing delay for next potential call."); await new Promise(resolve => setTimeout(resolve, API_CALL_DELAY * 2)); lastApiCallTime = Date.now(); } }
        return null;
    };
    let foundImage = await executeSearch(primarySearchQuery); if (foundImage) return foundImage; if (specificSearchQuery) { foundImage = await executeSearch(specificSearchQuery); if (foundImage) return foundImage; } if (baseTitleQuery) { foundImage = await executeSearch(baseTitleQuery); if (foundImage) return foundImage; } console.log(`Image search failed for: "${title}" (Season: ${seasonNumber})`); return null;
}

// --- Data Integrity ---
const runIntegrityCheck = (animesList) => {
    let changed = false; if (!Array.isArray(animesList)) return { checkedAnimes: [], changed: true };
    const checkedAnimes = animesList.map(anime => {
        if (!anime || typeof anime.id === 'undefined' || typeof anime.name === 'undefined') { console.warn("Integrity Check: Removed invalid anime entry:", anime); changed = true; return null; }
        let animeChanged = false; const initialAnimeString = JSON.stringify(anime);
        if (typeof anime.name !== 'string') { anime.name = String(anime.name || 'Unknown'); animeChanged = true; } if (!anime.name.trim()) { anime.name = 'Unknown'; animeChanged = true; } if (!anime.seasonType || !ALLOWED_SEASON_TYPES.includes(anime.seasonType)) { anime.seasonType = DEFAULT_SEASON_TYPE; animeChanged = true; } if (typeof anime.totalEpisodes !== 'number' || isNaN(anime.totalEpisodes) || anime.totalEpisodes < 0) { anime.totalEpisodes = 0; animeChanged = true; } if (typeof anime.watchedEpisodes !== 'number' || isNaN(anime.watchedEpisodes) || anime.watchedEpisodes < 0) { anime.watchedEpisodes = 0; animeChanged = true; } if (!anime.status || !ALLOWED_STATUSES.includes(anime.status)) { anime.status = DEFAULT_STATUS; animeChanged = true; } if (typeof anime.image !== 'string') { anime.image = DEFAULT_IMAGE_PATH; animeChanged = true; } if (!anime.image.trim()) { anime.image = DEFAULT_IMAGE_PATH; animeChanged = true; } if (typeof anime.id !== 'string') { anime.id = String(anime.id); animeChanged = true; } let currentSeasonNumber = anime.seasonNumber; if (anime.seasonType === 'Season') { const parsedNum = parseInt(currentSeasonNumber, 10); if (isNaN(parsedNum) || parsedNum < 1) { anime.seasonNumber = 1; animeChanged = true; } else { anime.seasonNumber = parsedNum; } } else { if (currentSeasonNumber === null || currentSeasonNumber === undefined) { if (anime.seasonNumber !== null) { anime.seasonNumber = null; } } else { const parsedNum = parseInt(currentSeasonNumber, 10); if (isNaN(parsedNum) || parsedNum < 0) { anime.seasonNumber = null; animeChanged = true; } else { anime.seasonNumber = parsedNum; } } } if (typeof anime.seasonNumber !== 'number' && anime.seasonNumber !== null) { anime.seasonNumber = null; animeChanged = true; } if (typeof anime.image === 'string' && !anime.image.startsWith('http') && !anime.image.startsWith('file:') && anime.image !== DEFAULT_IMAGE_PATH) { anime.image = DEFAULT_IMAGE_PATH; animeChanged = true; } if (anime.seasonType === 'Movie') { if (anime.totalEpisodes !== 1) { anime.totalEpisodes = 1; animeChanged = true; } if (anime.watchedEpisodes > 1) { anime.watchedEpisodes = 1; animeChanged = true; } } if (anime.totalEpisodes >= 0 && anime.watchedEpisodes > anime.totalEpisodes) { anime.watchedEpisodes = anime.totalEpisodes; animeChanged = true; } const currentStatus = anime.status; const watched = anime.watchedEpisodes; const total = anime.totalEpisodes; if (total > 0 && watched === total && currentStatus !== 'Completed') { anime.status = 'Completed'; animeChanged = true; } else if (watched < total && currentStatus === 'Completed') { anime.status = 'Watching'; animeChanged = true; } else if (watched > 0 && currentStatus === 'Plan to Watch') { anime.status = 'Watching'; animeChanged = true; } else if (watched === 0 && (currentStatus === 'Watching' || currentStatus === 'On Hold')) { anime.status = 'Plan to Watch'; animeChanged = true; } if (animeChanged) { console.log(`Integrity Check Modified: ${anime.name} (ID: ${anime.id})\n   Before: ${initialAnimeString}\n   After : ${JSON.stringify(anime)}`); changed = true; } return anime;
    }).filter(anime => anime !== null); return { checkedAnimes, changed };
};

const updateAnimesIntegrity = () => {
    try {
        let currentAnimes = animeStore.get('animes'); if (!Array.isArray(currentAnimes)) { console.warn("Anime data in store is not an array. Resetting to empty."); currentAnimes = []; } const { checkedAnimes, changed } = runIntegrityCheck(currentAnimes); if (changed) { console.log("Updating anime data store due to integrity check changes."); animeStore.set('animes', checkedAnimes); } else { console.log("Integrity check passed. No changes needed."); }
    } catch (error) { console.error("Error during integrity check:", error); }
};

// --- File I/O ---
const readImportFile = (filePath) => { try { if (!fs.existsSync(filePath)) return { success: false, error: 'File not found.' }; const data = fs.readFileSync(filePath, 'utf-8'); if (!data.trim()) return { success: false, error: 'File is empty.' }; const content = JSON.parse(data); if (!Array.isArray(content)) return { success: false, error: 'Imported file does not contain a valid JSON array.' }; return { success: true, data: content }; } catch (error) { console.error(`Error reading/parsing import file ${filePath}:`, error.message); const errorReason = error instanceof SyntaxError ? 'Invalid JSON format' : error.message; return { success: false, error: `Error reading import file: ${errorReason}` }; } };
const writeExportFile = (dataToWrite, filePath) => { try { const dir = path.dirname(filePath); if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); } fs.writeFileSync(filePath, JSON.stringify(dataToWrite, null, 2), 'utf-8'); console.log(`Successfully wrote export data to ${path.basename(filePath)}`); return { success: true }; } catch (error) { console.error(`Error writing export file ${filePath}:`, error.message); return { success: false, error: `File write error (${path.basename(filePath)}): ${error.message}` }; } };

// --- Initialization Function ---
function initializeDataHandlers(mainWindowRef) {
    console.log("Initializing Data Handlers...");
    updateAnimesIntegrity(); // Run check on startup

    // --- Register IPC Handlers ---
    ipcMain.handle('getAnimes', async () => { try { const animes = animeStore.get('animes'); if (!Array.isArray(animes)) { console.warn('[IPC getAnimes] Data from store is not an array, returning empty array.'); return []; } return animes; } catch (error) { console.error("[IPC getAnimes] Error getting animes:", error); return []; } });
    ipcMain.handle('addAnimeEntry', async (event, animeData) => { if (!animeData?.name?.trim() || !animeData.seasonType || !ALLOWED_SEASON_TYPES.includes(animeData.seasonType) || typeof animeData.totalEpisodes === 'undefined') { return { success: false, error: 'Invalid input data.' }; } let seasonNumber = null; let totalEpisodes = parseInt(animeData.totalEpisodes, 10); if (animeData.seasonType === 'Season') { const p = parseInt(animeData.seasonNumber, 10); if (isNaN(p) || p < 1) { return { success: false, error: 'swalValidationSeasonNumber' }; } seasonNumber = p; } else if (animeData.seasonNumber !== null && animeData.seasonNumber !== undefined && String(animeData.seasonNumber).trim() !== '') { const p = parseInt(animeData.seasonNumber, 10); if (isNaN(p) || p < 0) { return { success: false, error: 'Invalid number.' }; } seasonNumber = p; } if (isNaN(totalEpisodes) || totalEpisodes < 0) { return { success: false, error: 'Invalid total episodes.' }; } if (animeData.seasonType === 'Movie') { totalEpisodes = 1; } try { let animes = animeStore.get('animes'); if (!Array.isArray(animes)) animes = []; const newId = `anime_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`; const animeName = animeData.name.trim(); let finalImageUrl = DEFAULT_IMAGE_PATH; const providedImageUrl = animeData.image?.trim(); if (providedImageUrl && providedImageUrl.startsWith('http')) { finalImageUrl = providedImageUrl; } else { try { const searchSN = (animeData.seasonType === 'Season' && seasonNumber !== null) ? seasonNumber : null; const foundImage = await searchAnimeImage(animeName, searchSN); if (foundImage) { finalImageUrl = foundImage; } } catch (searchError) { console.error(`[IPC addAnimeEntry] Jikan search error:`, searchError); } } const newAnime = { id: newId, name: animeName, image: finalImageUrl, seasonType: animeData.seasonType, seasonNumber: seasonNumber, totalEpisodes: totalEpisodes, watchedEpisodes: 0, status: DEFAULT_STATUS }; const exists = animes.some(a => a?.name?.toLowerCase() === newAnime.name.toLowerCase() && a.seasonType === newAnime.seasonType && a.seasonNumber === newAnime.seasonNumber); if (exists) { const duplicateIdentifier = `${newAnime.name} (${newAnime.seasonType}${newAnime.seasonNumber !== null ? ' '+newAnime.seasonNumber : ''})`; return { success: false, error: `"${duplicateIdentifier}" already exists.` }; } animes.push(newAnime); animeStore.set('animes', animes); return { success: true, animeInfo: newAnime }; } catch (error) { console.error("[IPC addAnimeEntry] Error adding anime:", error); return { success: false, error: `Error saving: ${error.message}` }; } });
    ipcMain.handle('updateWatchedEpisodes', async (event, animeId, newWatchedCount) => { if (animeId === undefined || newWatchedCount === undefined) return { success: false, error: 'Missing data.' }; try { let animes = animeStore.get('animes'); if (!Array.isArray(animes)) return { success: false, error: 'No data.' }; const idx = animes.findIndex(a => a.id === animeId); if (idx === -1) return { success: false, error: 'Not found.' }; const anime = { ...animes[idx] }; const origS = anime.status || DEFAULT_STATUS; const origW = anime.watchedEpisodes ?? 0; const totalE = anime.totalEpisodes ?? 0; const maxW = (anime.seasonType === 'Movie') ? 1 : totalE; const valC = parseInt(newWatchedCount, 10); let finalC = origW; if (!isNaN(valC)) { finalC = Math.max(0, Math.min(valC, maxW)); } else { return { success: false, error: 'Invalid count.' }; } const countCh = origW !== finalC; let statusCh = false; if (countCh) { if (finalC === totalE && totalE > 0 && origS !== 'Completed') { anime.status = 'Completed'; statusCh = true; } else if (finalC < totalE && origS === 'Completed') { anime.status = 'Watching'; statusCh = true; } else if (finalC > 0 && origS === 'Plan to Watch') { anime.status = 'Watching'; statusCh = true; } else if (anime.seasonType === 'Movie') { if (finalC === 1 && origS !== 'Completed') { anime.status = 'Completed'; statusCh = true; } else if (finalC === 0 && origW === 1 && origS === 'Completed') { anime.status = 'Watching'; statusCh = true; } } } anime.watchedEpisodes = finalC; if (countCh || statusCh) { animes[idx] = anime; animeStore.set('animes', animes); return { success: true, updatedAnime: anime }; } else { return { success: true, updatedAnime: animes[idx] }; } } catch (error) { console.error("Error updating watched episodes:", error); return { success: false, error: `Save error: ${error.message}` }; } });
    ipcMain.handle('updateTotalEpisodes', async (event, animeId, newTotalCount) => { if (typeof animeId === 'undefined' || typeof newTotalCount === 'undefined') return { success: false, error: 'Missing data for total episode update.' }; const totalEpisodes = parseInt(newTotalCount, 10); if (isNaN(totalEpisodes) || totalEpisodes < 0) return { success: false, error: 'Invalid total episode count provided (must be >= 0).' }; try { let animes = animeStore.get('animes'); if (!Array.isArray(animes)) return { success: false, error: 'Could not read anime data.' }; const idx = animes.findIndex(a => a.id === animeId); if (idx === -1) return { success: false, error: 'Anime not found.' }; const anime = { ...animes[idx] }; const origTot = anime.totalEpisodes ?? 0; const origWat = anime.watchedEpisodes ?? 0; let watchCh = false; let statusCh = false; if (anime.seasonType === 'Movie') { return { success: false, error: 'Cannot change total episodes for Movie type.' }; } const totalCh = origTot !== totalEpisodes; if (totalCh) { anime.totalEpisodes = totalEpisodes; if (origWat > totalEpisodes) { anime.watchedEpisodes = totalEpisodes; watchCh = true; } const curStat = anime.status || DEFAULT_STATUS; const curWat = anime.watchedEpisodes; if (totalEpisodes > 0 && curWat === totalEpisodes && curStat !== 'Completed') { anime.status = 'Completed'; statusCh = true; } else if (curWat < totalEpisodes && curStat === 'Completed') { anime.status = 'Watching'; statusCh = true; } } if (totalCh || watchCh || statusCh) { animes[idx] = anime; animeStore.set('animes', animes); return { success: true, updatedAnime: anime }; } else { return { success: true, updatedAnime: animes[idx] }; } } catch (error) { console.error("Error updating total episodes:", error); return { success: false, error: `Save error: ${error.message}` }; } });
    ipcMain.handle('updateAnimeStatus', async (event, animeId, newStatus) => { if (!animeId || !newStatus || !ALLOWED_STATUSES.includes(newStatus)) return { success: false, error: "Invalid data." }; try { let animes = animeStore.get('animes'); if (!Array.isArray(animes)) return { success: false, error: 'No data.' }; const idx = animes.findIndex(a => a.id === animeId); if (idx === -1) return { success: false, error: 'Not found.' }; const anime = { ...animes[idx] }; const origS = anime.status; let epsCh = false; if (newStatus === 'Completed' && anime.watchedEpisodes !== anime.totalEpisodes) { if (anime.seasonType === 'Movie' && anime.watchedEpisodes !== 1) { anime.watchedEpisodes = 1; epsCh = true; } else if (anime.seasonType !== 'Movie') { anime.watchedEpisodes = anime.totalEpisodes ?? 0; epsCh = true; } } else if (newStatus === 'Plan to Watch' && anime.watchedEpisodes !== 0) { anime.watchedEpisodes = 0; epsCh = true; } const statusCh = origS !== newStatus; if (statusCh) anime.status = newStatus; if (statusCh || epsCh) { animes[idx] = anime; animeStore.set('animes', animes); return { success: true, updatedAnime: anime }; } else { return { success: true, updatedAnime: animes[idx] }; } } catch (error) { console.error("Error updating status:", error); return { success: false, error: `Save error: ${error.message}` }; } });
    ipcMain.handle('deleteAnime', async (event, animeId) => { if (!animeId) return { success: false, error: 'Missing ID.' }; try { let animes = animeStore.get('animes'); if (!Array.isArray(animes)) return { success: false, error: 'No data.' }; const initialLength = animes.length; const updatedAnimes = animes.filter(a => a.id !== animeId); if (updatedAnimes.length === initialLength) { return { success: false, error: 'Anime not found.' }; } animeStore.set('animes', updatedAnimes); return { success: true }; } catch (error) { console.error("Error deleting anime:", error); return { success: false, error: `Save error: ${error.message}` }; } });
    ipcMain.handle('openImportDialog', async () => { if (!mainWindowRef) return { canceled: true, filePaths: [] }; try { const result = await dialog.showOpenDialog(mainWindowRef, { title: 'Import JSON', properties: ['openFile'], filters: [{ name: 'JSON Files', extensions: ['json'] }] }); return { canceled: result.canceled, filePaths: result.filePaths }; } catch (error) { console.error("Error showing import dialog:", error); return { canceled: true, filePaths: [] }; } });
    ipcMain.handle('openExportDialog', async () => { if (!mainWindowRef) return { success: false, canceled: true }; try { const result = await dialog.showSaveDialog(mainWindowRef, { title: 'Export Anime List', defaultPath: 'animes-export.json', filters: [{ name: 'JSON Files', extensions: ['json'] }] }); if (result.canceled || !result.filePath) { return { success: false, canceled: true }; } const currentAnimes = animeStore.get('animes'); if (!Array.isArray(currentAnimes)) { throw new Error('Could not read data from store for export.'); } const writeResult = writeExportFile(currentAnimes, result.filePath); return writeResult; } catch (error) { console.error("Error during export process:", error); return { success: false, canceled: false, error: `Export error: ${error.message}` }; } });
    ipcMain.handle('importData', async (event, sourceFilePath, mode) => { if (!sourceFilePath || !mode || (mode !== 'overwrite' && mode !== 'merge')) { return { success: false, error: 'Missing file path or invalid import mode.' }; } let processedCount = 0; let finalAnimes = []; try { const readResult = readImportFile(sourceFilePath); if (!readResult.success) throw new Error(readResult.error); let importedAnimes = readResult.data; const checkedImport = runIntegrityCheck(importedAnimes); if (checkedImport.changed) { console.warn("Integrity check modified imported data before processing."); } importedAnimes = checkedImport.checkedAnimes; let currentAnimes = animeStore.get('animes'); if (!Array.isArray(currentAnimes)) { currentAnimes = []; } if (mode === 'overwrite') { finalAnimes = importedAnimes; processedCount = importedAnimes.length; } else { finalAnimes = [...currentAnimes]; const currentKeys = new Set(currentAnimes.map(a => `${a.name?.toLowerCase()}_${a.seasonType||DEFAULT_SEASON_TYPE}_${a.seasonNumber === undefined || a.seasonNumber === null ? 'null' : a.seasonNumber}`)); let addedCount = 0; for (const importedEntry of importedAnimes) { const impNum = importedEntry.seasonNumber === undefined || importedEntry.seasonNumber === null ? 'null' : importedEntry.seasonNumber; const impKey = `${importedEntry.name?.toLowerCase()}_${importedEntry.seasonType}_${impNum}`; if (!currentKeys.has(impKey)) { finalAnimes.push(importedEntry); currentKeys.add(impKey); addedCount++; } else { console.log(`Skipping duplicate during merge: ${impKey}`); } } processedCount = addedCount; } const { checkedAnimes: finalCheckedAnimes } = runIntegrityCheck(finalAnimes); animeStore.set('animes', finalCheckedAnimes); return { success: true, count: processedCount }; } catch (error) { console.error("Error during import process:", error); return { success: false, error: `Import error: ${error.message}` }; } });
    ipcMain.handle('clearData', async () => { try { animeStore.set('animes', []); return { success: true }; } catch (error) { console.error("Error clearing data:", error); return { success: false, error: `Clear error: ${error.message}` }; } });
    ipcMain.handle('getLanguagePreference', async () => { try { const lang = settingsStore.get('selectedLanguage'); return typeof lang === 'string' ? lang : 'en'; } catch (error) { console.error("Error getting language preference:", error); return 'en'; } });
    ipcMain.handle('saveLanguagePreference', async (event, langCode) => { try { if (typeof langCode === 'string' && langCode.length > 0) { settingsStore.set('selectedLanguage', langCode); return { success: true }; } else { return { success: false, error: 'Invalid language code provided.' }; } } catch (error) { console.error("Error saving language preference:", error); return { success: false, error: `Save error: ${error.message}` }; } });

    // ---> ADDED HANDLER FOR APP VERSION <---
    ipcMain.handle('get-app-version', () => {
        console.log("[IPC] get-app-version requested");
        return app.getVersion(); // Returns the version from package.json
    });
    // ---> END ADDED HANDLER <---

    console.log("Data Handlers Initialized.");
} // End initializeDataHandlers

module.exports = { initializeDataHandlers };
// <-- end comment (.js file)(src/main-process/anime-data-handler.js)
// <-- end comment (.js file)(src/main-process/anime-data-handler.js)