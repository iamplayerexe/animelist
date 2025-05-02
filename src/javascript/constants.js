const ALLOWED_SEASON_TYPES = ['Season', 'OVA', 'Movie', 'Special', 'Scan', 'Non-Canon'];
const DEFAULT_SEASON_TYPE = 'Season';

module.exports = {
    DEFAULT_IMAGE: './assets/default-avatar.png',
    STATUS_OPTIONS: ['Plan to Watch', 'Watching', 'Completed', 'On Hold', 'Dropped'],
    DEFAULT_STATUS: 'Plan to Watch',
    SIDEBAR_EXPANDED_ICON: './assets/menu.png',
    SIDEBAR_COLLAPSED_ICON: './assets/app.png',
    JIKAN_API_URL: 'https://api.jikan.moe/v4/anime',
    ALLOWED_SEASON_TYPES: ALLOWED_SEASON_TYPES,
    DEFAULT_SEASON_TYPE: DEFAULT_SEASON_TYPE,
};