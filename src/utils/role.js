/**
 * Build a role mention string based on task kelas and guild roles config
 * @param {string} taskKelas The class of the task ('A', 'B', 'Semua')
 * @param {Array} roles Database roles array for the guild
 * @returns {string} The role mention string
 */
function buildRoleMention(taskKelas, roles) {
    const roleMap = {};
    for (const r of roles) {
        roleMap[r.kelas] = r.roleId;
    }

    if (taskKelas === 'A' && roleMap['A']) {
        return `<@&${roleMap['A']}>`;
    }
    if (taskKelas === 'B' && roleMap['B']) {
        return `<@&${roleMap['B']}>`;
    }
    if (taskKelas === 'Semua') {
        const mentions = [];
        if (roleMap['A']) mentions.push(`<@&${roleMap['A']}>`);
        if (roleMap['B']) mentions.push(`<@&${roleMap['B']}>`);
        return mentions.length > 0 ? mentions.join(' ') : '@everyone';
    }

    return ''; // Fallback
}

module.exports = { buildRoleMention };
