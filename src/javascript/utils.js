const Swal = require('sweetalert2');
// Updated path for translate
const { translate } = require('./handlers/language-handler');

const Toast = Swal.mixin({
  toast: true,
  position: 'bottom-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer;
    toast.onmouseleave = Swal.resumeTimer;
  },
  customClass: {
    popup: 'custom-toast-popup',
  }
});

function setButtonSuccess(buttonElement, messageKey, placeholderValues = {}) {
    if (!buttonElement) return;
    const message = translate(messageKey, placeholderValues);
    buttonElement.classList.add('success');
    buttonElement.disabled = true;
    Toast.fire({ icon: 'success', title: message || translate('operationSuccess', {fallback: 'Success!'}) });
    setTimeout(() => {
        if (buttonElement) {
            buttonElement.classList.remove('success');
            buttonElement.disabled = false;
        }
    }, 3000);
}

function setButtonError(buttonElement, messageKey, placeholderValues = {}) {
    if (!buttonElement) return;
    const message = translate(messageKey, placeholderValues);
    buttonElement.classList.add('error');
    buttonElement.disabled = true;
    Toast.fire({ icon: 'error', title: message || translate('errorOccurred', { fallback: 'An error occurred.' }) });
    setTimeout(() => {
        if (buttonElement) {
            buttonElement.classList.remove('error');
            buttonElement.disabled = false;
        }
    }, 3000);
}

function formatDisplayTitle(officialName, seasonType, seasonNumber) {
    let displayTitle = officialName || translate('swalDetailsUnknown', { fallback: 'Unknown Title'});
    let suffix = '';
    // No path change needed here as constants is in the same dir level
    const constants = require('./constants');
    const DEFAULT_SEASON_TYPE = constants.DEFAULT_SEASON_TYPE;
    const ALLOWED_SEASON_TYPES = constants.ALLOWED_SEASON_TYPES;

    // Ensure type is valid, fallback to default
    const type = seasonType && ALLOWED_SEASON_TYPES.includes(seasonType)
                 ? seasonType
                 : DEFAULT_SEASON_TYPE;

    const typeKey = `seasonType${type.replace('-', '')}`; // e.g., seasonTypeNonCanon
    const translatedType = translate(typeKey, { fallback: type });

    if (type === 'Season') {
        const num = parseInt(seasonNumber, 10);
        if (!isNaN(num) && num > 0) {
            // Simple check if " S{num}" or " Season {num}" is already in the name (case-insensitive)
            const nameLower = displayTitle.toLowerCase();
            const pattern1 = ` season ${num}`;
            const pattern2 = ` s${num}`;
            const baseNameIncludesSeason = nameLower.includes(pattern1.trim()) || nameLower.includes(pattern2.trim());
            // Add suffix only if it's not already obviously part of the name
            if (!baseNameIncludesSeason && !nameLower.endsWith(pattern1) && !nameLower.endsWith(pattern2)) {
                suffix = ` - S${num}`;
            }
        }
    } else {
        // For non-Season types, always show the translated type
        suffix = ` - ${translatedType}`;
        const num = parseInt(seasonNumber, 10);
        // Append number if it's valid and > 0
        if (!isNaN(num) && num > 0) {
            suffix += ` ${num}`;
        }
    }
    // Ensure no leading/trailing whitespace on suffix
    suffix = suffix.trim();
    return { displayTitle: displayTitle.trim(), seasonSuffix: suffix };
}


module.exports = {
    Toast,
    setButtonSuccess,
    setButtonError,
    formatDisplayTitle,
    translate, // Export translate directly from here as well if needed, or rely on importing it from language-handler
};