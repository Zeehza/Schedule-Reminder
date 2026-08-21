const cron = require('node-cron');
const moment = require('moment-timezone');
const { GuildScheduledEventPrivacyLevel, GuildScheduledEventEntityType, EmbedBuilder } = require('discord.js');
const { getDb } = require('../database/connection');
const { TIMEZONE } = require('../utils/time');
const { removePinnedTaskMessage, pinTaskMessage } = require('./pinManager');
const { parseICS } = require('./icsParser');
const { generateTaskId } = require('../utils/time');
const { buildRoleMention } = require('../utils/role');

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
                // Only send notifications if task is still pending
                if (task.status !== 'completed') {
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
                }

                // Phase 5: Resolution (Pasca-Deadline)
                if (diffMinutes <= 0) {
                    // Only unpin if it wasn't already marked as completed (which unpins it earlier)
                    // But unpinning an already unpinned message in pinManager handles gracefully usually.
                    await removePinnedTaskMessage(client, task.id);
                    
                    if (task.repeat_status === 'Once') {
                        // Mark as completed instead of deleting so it stays in history
                        await pool.query(`UPDATE tasks SET status = 'completed' WHERE id = ? AND guildId = ?`, [task.id, task.guildId]);
                    } else if (task.repeat_status === 'Weekly') {
                        const nextDeadlineUtc = deadlineUtc.add(7, 'days').format('YYYY-MM-DD HH:mm:ss');
                        // Reset status to pending for the new week
                        await pool.query(`UPDATE tasks SET deadline = ?, status = 'pending' WHERE id = ? AND guildId = ?`, [nextDeadlineUtc, task.id, task.guildId]);
                        
                        // Repin the task with the new deadline
                        task.deadline = nextDeadlineUtc;
                        task.status = 'pending';
                        await pinTaskMessage(client, task);
                    }
                }
            }
        } catch (error) {
            console.error('Error in cron job:', error);
        }
    });

    // Auto-cleanup job: runs every day at 00:00 (midnight)
    cron.schedule('0 0 * * *', async () => {
        try {
            const pool = getDb();
            const thirtyDaysAgoUtc = moment().utc().subtract(30, 'days').format('YYYY-MM-DD HH:mm:ss');
            
            const [result] = await pool.query(
                `DELETE FROM tasks WHERE status = 'completed' AND deadline < ?`, 
                [thirtyDaysAgoUtc]
            );
            
            if (result.affectedRows > 0) {
                console.log(`Auto-cleanup: Deleted ${result.affectedRows} completed tasks older than 30 days.`);
            }
        } catch (error) {
            console.error('Error in auto-cleanup cron job:', error);
        }
    });

    // Auto-sync job: runs every hour
    cron.schedule('0 * * * *', async () => {
        try {
            const pool = getDb();
            const [syncUrls] = await pool.query('SELECT * FROM sync_urls');
            
            for (const syncJob of syncUrls) {
                try {
                    const response = await fetch(syncJob.url);
                    if (!response.ok) continue;
                    
                    const data = await response.text();
                    const tasks = parseICS(data);
                    
                    if (tasks.length === 0) continue;
                    
                    let newTasksCount = 0;
                    
                    for (const task of tasks) {
                        // Check if task exists based on UID (if available) or description+deadline
                        let exists = false;
                        if (task.uid) {
                            const [existing] = await pool.query(
                                'SELECT id FROM tasks WHERE guildId = ? AND uid = ?',
                                [syncJob.guildId, task.uid]
                            );
                            if (existing.length > 0) exists = true;
                        } else {
                            // Fallback to description + deadline
                            const [existing] = await pool.query(
                                'SELECT id FROM tasks WHERE guildId = ? AND description = ? AND deadline = ?',
                                [syncJob.guildId, task.description || 'Task', task.deadlineUtc]
                            );
                            if (existing.length > 0) exists = true;
                        }
                        
                        if (!exists) {
                            const taskId = generateTaskId();
                            await pool.query(
                                `INSERT INTO tasks (id, guildId, uid, description, deadline, link, repeat_status, kelas) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                [taskId, syncJob.guildId, task.uid || null, task.description || 'Task', task.deadlineUtc, task.link, 'Once', syncJob.kelas]
                            );
            
                            await pinTaskMessage(client, {
                                id: taskId,
                                guildId: syncJob.guildId,
                                description: task.description || 'Task',
                                deadline: task.deadlineUtc,
                                link: task.link,
                                kelas: syncJob.kelas
                            });
                            
                            newTasksCount++;
                        }
                    }
                    
                    // Update last sync time
                    const nowWib = moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss');
                    await pool.query('UPDATE sync_urls SET last_sync = ? WHERE id = ?', [nowWib, syncJob.id]);
                    
                    if (newTasksCount > 0) {
                        console.log(`Auto-sync: Added ${newTasksCount} new tasks for guild ${syncJob.guildId}, kelas ${syncJob.kelas}`);
                    }
                } catch (err) {
                    console.error(`Error auto-syncing URL ${syncJob.url}:`, err);
                }
            }
        } catch (error) {
            console.error('Error in auto-sync cron job:', error);
        }
    });

    console.log('Cron job, auto-cleanup, and auto-sync started successfully.');
}

module.exports = { startCronJob };
