const ical = require('node-ical');

const courseMap = {
    'TK245009': 'Pemrograman Web II',
    'TK245008': 'Manajemen Proyek',
    'TK245007': 'Metode Numerik',
    'TK245006': 'Etika Profesi',
    'TK245004': 'Internet of Things',
    'TK245001': 'Sistem Kendali',
    'TK24A003': 'Supply Chain Management',
    'TK245005': 'Praktikum Sistem Internet of Thing',
    'TK245003': 'Praktikum Keamanan Jaringan Komputer',
    'TK245010': 'Praktikum Pemrograman Web II',
    'TK245002': 'Keamanan Jaringan Komputer'
};

function getMappedCourse(category) {
    if (!category) return null;
    for (const [code, name] of Object.entries(courseMap)) {
        if (category.includes(code)) {
            return name;
        }
    }
    return category;
}

/**
 * Parses ICS content and extracts task information.
 * @param {string} icsContent Raw ICS string
 * @returns {Array} Array of task objects { uid, description, details, course, deadlineUtc, link }
 */
function parseICS(icsContent) {
    const events = ical.sync.parseICS(icsContent);
    const tasks = [];

    // URL extraction regex
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    for (const key in events) {
        if (events.hasOwnProperty(key)) {
            const event = events[key];
            if (event.type === 'VEVENT') {
                const deadlineDate = event.end || event.dtend || event.start;
                if (!deadlineDate) continue;

                // node-ical parses dates to native Date objects
                // Format directly to YYYY-MM-DD HH:mm:ss in UTC
                const deadlineUtc = new Date(deadlineDate).toISOString().slice(0, 19).replace('T', ' ');

                const summary = event.summary || '';
                const description = event.description || '';
                
                const fullText = `${summary}\n${description}`;
                let finalDescription = summary;
                
                // Find URL
                let link = null;
                const urls = fullText.match(urlRegex);
                if (urls && urls.length > 0) {
                    link = urls[0];
                } else if (event.url) {
                    link = event.url;
                }

                let course = null;
                if (event.categories) {
                    let rawCategory = Array.isArray(event.categories) ? event.categories[0] : event.categories;
                    course = getMappedCourse(rawCategory);
                }

                tasks.push({
                    uid: event.uid || null,
                    description: finalDescription.substring(0, 3000), // Max limit
                    details: description.substring(0, 3000), // Original description
                    course: course,
                    deadlineUtc: deadlineUtc,
                    link: link
                });
            }
        }
    }

    return tasks;
}

module.exports = { parseICS };
