/**
 * Build a role mention string based on task kelas and guild roles config
 * @param {string} taskKelas The class of the task ('A', 'B', 'Semua')
 * @param {Array} roles Database roles array for the guild
 * @returns {{ mention: string, roleIds: string[] }} The role mention string and raw role IDs
 */
function buildRoleMention(taskKelas, roles) {
    const roleMap = {};
    for (const r of roles) {
        roleMap[r.kelas] = r.roleId;
    }

    if (taskKelas === 'A' && roleMap['A']) {
        return { mention: `<@&${roleMap['A']}>`, roleIds: [roleMap['A']] };
    }
    if (taskKelas === 'B' && roleMap['B']) {
        return { mention: `<@&${roleMap['B']}>`, roleIds: [roleMap['B']] };
    }
    if (taskKelas === 'Semua') {
        const mentions = [];
        const ids = [];
        if (roleMap['A']) { mentions.push(`<@&${roleMap['A']}>`); ids.push(roleMap['A']); }
        if (roleMap['B']) { mentions.push(`<@&${roleMap['B']}>`); ids.push(roleMap['B']); }
        if (mentions.length > 0) {
            return { mention: mentions.join(' '), roleIds: ids };
        }
        return { mention: '@everyone', roleIds: [] };
    }

    return { mention: '', roleIds: [] }; // Fallback
}

module.exports = { buildRoleMention };
