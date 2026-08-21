const ical = require('node-ical');

/**
 * Parses ICS content and extracts task information.
 * @param {string} icsContent Raw ICS string
 * @returns {Array} Array of task objects { uid, description, deadlineUtc, link }
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

                tasks.push({
                    uid: event.uid || null,
                    description: finalDescription.substring(0, 2000), // Max limit
                    deadlineUtc: deadlineUtc,
                    link: link
                });
            }
        }
    }

    return tasks;
}

module.exports = { parseICS };
