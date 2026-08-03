const cron = require('node-cron');
const moment = require('moment-timezone');
const { GuildScheduledEventPrivacyLevel, GuildScheduledEventEntityType, EmbedBuilder } = require('discord.js');
const { getDb } = require('../database/connection');
const { TIMEZONE } = require('../utils/time');
const { removePinnedTaskMessage, pinTaskMessage } = require('./pinManager');

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

                // Get notification channels for this guild
                const [channels] = await pool.query(`SELECT channelId, kelas FROM channels WHERE guildId = ?`, [task.guildId]);
                if (channels.length === 0) continue;

                // Get role mapping for this guild (cached)
                if (!roleCache[task.guildId]) {
                    const [roles] = await pool.query(`SELECT * FROM roles WHERE guildId = ?`, [task.guildId]);
                    const roleMap = {};
                    for (const r of roles) roleMap[r.kelas] = r.roleId;
                    roleCache[task.guildId] = roleMap;
                }
                const roleMap = roleCache[task.guildId];

                const taskKelas = task.kelas || 'Semua';
                let targetChannelsWithRoles = []; // Array of { channelId, kelasToPing }

                if (taskKelas === 'Semua') {
                    const semuaChannel = channels.find(c => c.kelas === 'Semua');
                    if (semuaChannel) {
                        targetChannelsWithRoles.push({ channelId: semuaChannel.channelId, kelasToPing: 'Semua' });
                    } else {
                        // Fallback: send to individual channels if 'Semua' channel not set
                        const aChannel = channels.find(c => c.kelas === 'A');
                        const bChannel = channels.find(c => c.kelas === 'B');
                        if (aChannel) targetChannelsWithRoles.push({ channelId: aChannel.channelId, kelasToPing: 'A' });
                        if (bChannel) targetChannelsWithRoles.push({ channelId: bChannel.channelId, kelasToPing: 'B' });
                    }
                } else {
                    const specificChannel = channels.find(c => c.kelas === taskKelas);
                    if (specificChannel) {
                        targetChannelsWithRoles.push({ channelId: specificChannel.channelId, kelasToPing: taskKelas });
                    } else {
                        const semuaChannel = channels.find(c => c.kelas === 'Semua');
                        if (semuaChannel) {
                            targetChannelsWithRoles.push({ channelId: semuaChannel.channelId, kelasToPing: taskKelas });
                        }
                    }
                }

                if (targetChannelsWithRoles.length === 0) continue;

                let linkText = '';
                if (task.link) {
                    let validLink = task.link;
                    if (!validLink.startsWith('http://') && !validLink.startsWith('https://')) {
                        validLink = 'https://' + validLink;
                    }
                    linkText = `\n🔗 Link: ${validLink}`;
                }

                // Phase 4: Notifications
                for (const target of targetChannelsWithRoles) {
                    const channel = client.channels.cache.get(target.channelId);
                    if (!channel) continue;

                    const mention = buildRoleMention(target.kelasToPing, roleMap);
                    const kelasLabel = taskKelas === 'Semua' ? '' : ` (Kelas ${taskKelas})`;

                    let embed = null;
                    if (diffMinutes === 72 * 60) {
                        // H-3 (72 Jam)
                        embed = new EmbedBuilder()
                            .setTitle(`🔴 PERHATIAN! H-3 Deadline!${kelasLabel}`)
                            .setDescription(`Tugas **${task.description}** harus dikumpulkan dalam 3 hari lagi.${linkText}`);
                    } else if (diffMinutes === 24 * 60) {
                        // H-1 (24 Jam)
                        embed = new EmbedBuilder()
                            .setTitle(`❗ PENGINGAT H-1!${kelasLabel}`)
                            .setDescription(`Besok adalah batas akhir pengumpulan **${task.description}**. Segera selesaikan!${linkText}`);
                    } else if (diffMinutes === 12 * 60) {
                        // H-12 Jam
                        embed = new EmbedBuilder()
                            .setTitle(`⚠️ FINAL REMINDER!${kelasLabel}`)
                            .setDescription(`Waktu tersisa 12 Jam lagi untuk mengumpulkan **${task.description}**!${linkText}`);
                    }

                    if (embed) {
                        embed.setColor('#9400d3')
                             .setTimestamp();
                        await channel.send({ content: mention, embeds: [embed] });
                    }
                }

                // Phase 5: Resolution (Pasca-Deadline)
                if (diffMinutes <= 0) {
                    await removePinnedTaskMessage(client, task.id);
                    
                    if (task.repeat_status === 'Once') {
                        await pool.query(`DELETE FROM tasks WHERE id = ? AND guildId = ?`, [task.id, task.guildId]);
                    } else if (task.repeat_status === 'Weekly') {
                        const nextDeadlineUtc = deadlineUtc.add(7, 'days').format('YYYY-MM-DD HH:mm:ss');
                        await pool.query(`UPDATE tasks SET deadline = ? WHERE id = ? AND guildId = ?`, [nextDeadlineUtc, task.id, task.guildId]);
                        
                        // Repin the task with the new deadline
                        task.deadline = nextDeadlineUtc;
                        await pinTaskMessage(client, task);
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
