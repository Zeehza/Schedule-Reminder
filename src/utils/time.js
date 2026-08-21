const crypto = require('crypto');

const TIMEZONE = 'Asia/Jakarta'; // WIB (UTC+7)

/**
 * Parses a date and time string from the modal into a UTC datetime string for DB storage
 * @param {string} dateStr Format: DD/MM/YYYY
 * @param {string} timeStr Format: HH:MM
 * @returns {string} MySQL datetime string (UTC)
 */
function parseWibToUtcString(dateStr, timeStr) {
    const [day, month, year] = dateStr.split('/');
    const [hour, minute] = timeStr.replace('.', ':').split(':');
    
    // Construct UTC date assuming input is UTC+7
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
    
    // Format to YYYY-MM-DD HH:mm:ss
    return utcDate.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Formats a UTC date string from DB to WIB display string
 * @param {string} utcDateStr MySQL datetime string (UTC)
 * @returns {Object} { date: 'DD/MM/YYYY', time: 'HH.mm' }
 */
function formatUtcToWib(utcDateStr) {
    const date = new Date(utcDateStr.endsWith('Z') ? utcDateStr : utcDateStr.replace(' ', 'T') + 'Z');

    const options = { timeZone: TIMEZONE };
    
    // Format helpers
    const dtfDate = new Intl.DateTimeFormat('id-ID', { ...options, day: '2-digit', month: '2-digit', year: 'numeric' });
    const dtfDateDisplay = new Intl.DateTimeFormat('id-ID', { ...options, day: '2-digit', month: 'long', year: 'numeric' });
    const dtfTime = new Intl.DateTimeFormat('id-ID', { ...options, hour: '2-digit', minute: '2-digit', hour12: false });
    
    const formattedDate = dtfDate.format(date); // DD/MM/YYYY
    const formattedDateDisplay = dtfDateDisplay.format(date); // DD MMMM YYYY
    const formattedTime = dtfTime.format(date).replace(':', '.'); // HH.mm
    
    return {
        date: formattedDate,
        dateDisplay: formattedDateDisplay,
        time: formattedTime,
        full: `${formattedDateDisplay} ${formattedTime}`
    };
}

/**
 * Generates a unique task ID
 * @returns {string}
 */
function generateTaskId() {
    return `#TGS-${crypto.randomInt(1000, 10000)}`;
}

module.exports = {
    parseWibToUtcString,
    formatUtcToWib,
    generateTaskId,
    TIMEZONE
};
