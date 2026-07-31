const cron = require('node-cron');
const moment = require('moment-timezone');
const { GuildScheduledEventPrivacyLevel, GuildScheduledEventEntityType } = require('discord.js');
const { getDb } = require('../database/connection');
const { TIMEZONE } = require('../utils/time');

/**
 * Build a role mention string based on task kelas and guild roles config
 * @param {string} kelas - 'A', 'B', or 'Semua'
 * @param {Object} roleMap - { A: roleId, B: roleId }
 * @returns {string} mention string
 */
function buildRoleMention(kelas, roleMap) {
    if (kelas === 'A' && roleMap['A']) {
        return `<@&${roleMap['A']}>`;
    } else if (kelas === 'B' && roleMap['B']) {
        return `<@&${roleMap['B']}>`;
    } else if (kelas === 'Semua') {
        const mentions = [];
        if (roleMap['A']) mentions.push(`<@&${roleMap['A']}>`);
        if (roleMap['B']) mentions.push(`<@&${roleMap['B']}>`);
        return mentions.length > 0 ? mentions.join(' ') : '@everyone';
    }
    return '@everyone';
}

function startCronJob(client) {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        try {
            const pool = getDb();
            const nowUtc = moment().utc();

            // Fetch all tasks
            const [tasks] = await pool.query(`SELECT * FROM tasks`);

            // Cache role mappings per guild to avoid redundant queries
            const roleCache = {};

            for (const task of tasks) {
                const deadlineUtc = moment.utc(task.deadline);
                const diffMinutes = deadlineUtc.diff(nowUtc, 'minutes');

                // Get notification channel for this guild
                const [channels] = await pool.query(`SELECT channelId FROM channels WHERE guildId = ?`, [task.guildId]);
                if (channels.length === 0) continue;

                const channelId = channels[0].channelId;
                const channel = client.channels.cache.get(channelId);

                if (!channel) continue;

                // Get role mapping for this guild (cached)
                if (!roleCache[task.guildId]) {
                    const [roles] = await pool.query(`SELECT * FROM roles WHERE guildId = ?`, [task.guildId]);
                    const roleMap = {};
                    for (const r of roles) roleMap[r.kelas] = r.roleId;
                    roleCache[task.guildId] = roleMap;
                }
                const roleMap = roleCache[task.guildId];

                const kelas = task.kelas || 'Semua';
                const mention = buildRoleMention(kelas, roleMap);
                const kelasLabel = kelas === 'Semua' ? '' : ` (Kelas ${kelas})`;

                let linkText = '';
                if (task.link) {
                    let validLink = task.link;
                    if (!validLink.startsWith('http://') && !validLink.startsWith('https://')) {
                        validLink = 'https://' + validLink;
                    }
                    linkText = `\n🔗 Link: ${validLink}`;
                }

                // Phase 4: Notifications
                if (diffMinutes === 72 * 60) {
                    // H-3 (72 Jam)
                    await channel.send(
                        `🔴 ${mention} **PERHATIAN! H-3 Deadline!${kelasLabel}**\nTugas **${task.description}** harus dikumpulkan dalam 3 hari lagi.${linkText}`
                    );

                    try {
                        const guild = client.guilds.cache.get(task.guildId);
                        if (guild) {
                            const startTime = deadlineUtc.toDate();
                            const endTime = deadlineUtc.clone().add(1, 'hour').toDate();

                            await guild.scheduledEvents.create({
                                name: task.description.substring(0, 100),
                                scheduledStartTime: startTime,
                                scheduledEndTime: endTime,
                                privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
                                entityType: GuildScheduledEventEntityType.External,
                                entityMetadata: { location: task.link ? task.link.substring(0, 100) : 'Ruang Kelas / Tugas' },
                                description: `Tugas: ${task.description}\nID: ${task.id}\nKelas: ${kelas}`,
                            });
                        }
                    } catch (err) {
                        console.error('Gagal membuat Discord Event:', err);
                    }
                } else if (diffMinutes === 24 * 60) {
                    // H-1 (24 Jam)
                    await channel.send(
                        `❗ ${mention} **PENGINGAT H-1!${kelasLabel}**\nBesok adalah batas akhir pengumpulan **${task.description}**. Segera selesaikan!${linkText}`
                    );
                } else if (diffMinutes === 12 * 60) {
                    // H-12 Jam
                    await channel.send(
                        `⚠️ ${mention} **FINAL REMINDER!${kelasLabel}**\nWaktu tersisa 12 Jam lagi untuk mengumpulkan **${task.description}**!${linkText}`
                    );
                }

                // Phase 5: Resolution (Pasca-Deadline)
                if (diffMinutes <= 0) {
                    if (task.repeat_status === 'Once') {
                        await pool.query(`DELETE FROM tasks WHERE id = ? AND guildId = ?`, [task.id, task.guildId]);
                    } else if (task.repeat_status === 'Weekly') {
                        const nextDeadlineUtc = deadlineUtc.add(7, 'days').format('YYYY-MM-DD HH:mm:ss');
                        await pool.query(`UPDATE tasks SET deadline = ? WHERE id = ? AND guildId = ?`, [nextDeadlineUtc, task.id, task.guildId]);
                    }
                }
            }
        } catch (error) {
            console.error('Error in cron job:', error);
        }
    });

    console.log('Cron job started successfully.');
}

module.exports = { startCronJob };
