const moment = require('moment-timezone');

const TIMEZONE = 'Asia/Jakarta'; // WIB (UTC+7)

/**
 * Parses a date and time string from the modal into a UTC datetime string for DB storage
 * @param {string} dateStr Format: DD/MM/YYYY
 * @param {string} timeStr Format: HH:MM
 * @returns {string} MySQL datetime string (UTC)
 */
function parseWibToUtcString(dateStr, timeStr) {
    const format = 'DD/MM/YYYY HH.mm';
    // Create moment object in WIB timezone
    const wibMoment = moment.tz(`${dateStr} ${timeStr}`, format, TIMEZONE);
    // Convert to UTC and format for MySQL
    return wibMoment.utc().format('YYYY-MM-DD HH:mm:ss');
}

/**
 * Formats a UTC date string from DB to WIB display string
 * @param {string} utcDateStr MySQL datetime string (UTC)
 * @returns {Object} { date: 'DD/MM/YYYY', time: 'HH:mm' }
 */
function formatUtcToWib(utcDateStr) {
    const wibMoment = moment.utc(utcDateStr).tz(TIMEZONE).locale('id');
    return {
        date: wibMoment.format('DD/MM/YYYY'), // for inputs (edit modal)
        dateDisplay: wibMoment.format('DD MMMM YYYY'), // for displaying in lists
        time: wibMoment.format('HH.mm'),
        full: wibMoment.format('DD MMMM YYYY HH.mm')
    };
}

/**
 * Gets the current time in WIB
 * @returns {moment.Moment}
 */
function getCurrentWibTime() {
    return moment().tz(TIMEZONE);
}

/**
 * Generates a unique task ID
 * @returns {string}
 */
function generateTaskId() {
    return `#TGS-${Math.floor(1000 + Math.random() * 9000)}`;
}

module.exports = {
    parseWibToUtcString,
    formatUtcToWib,
    getCurrentWibTime,
    generateTaskId,
    TIMEZONE
};
