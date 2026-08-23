const { GuildScheduledEventPrivacyLevel, GuildScheduledEventEntityType, EmbedBuilder } = require('discord.js');
const { getDb } = require('../database/connection');
const { TIMEZONE } = require('../utils/time');
const { removePinnedTaskMessage, pinTaskMessage } = require('./pinManager');
const { parseICS } = require('./icsParser');
const { generateTaskId } = require('../utils/time');
const { buildRoleMention } = require('../utils/role');

function startCronJob(client) {
    let lastProcessedMinute = -1;

    const runCronTick = async () => {
        const now = new Date();
        const currentMinute = now.getMinutes();

        // Ensure we only run tasks once per minute
        if (currentMinute === lastProcessedMinute) return;
        lastProcessedMinute = currentMinute;

        try {
            await runMinuteTasks(client);
        } catch (error) {
            console.error('Error in minute tasks:', error);
        }

        // Auto-cleanup job: runs every day at 00:00 (midnight)
        if (now.getHours() === 0 && currentMinute === 0) {
            try {
                await runDailyCleanup();
            } catch (error) {
                console.error('Error in auto-cleanup job:', error);
            }
        }

        // Auto-sync job: runs every hour at minute 0
        if (currentMinute === 0) {
            try {
                await runHourlySync(client);
            } catch (error) {
                console.error('Error in auto-sync job:', error);
            }
        }
    };

    // Run immediately on boot
    runCronTick();
    
    // Run interval every 60 seconds (once per minute is sufficient)
    setInterval(runCronTick, 60000);

    console.log('Cron job, auto-cleanup, and auto-sync started successfully (using native setInterval).');
}

async function runMinuteTasks(client) {
    const pool = getDb();
    const nowUtc = new Date();

    // Fetch only pending tasks to avoid processing completed tasks every minute
    const [tasks] = await pool.query(`SELECT * FROM tasks WHERE status = 'pending'`);

    // Cache role mappings per guild to avoid redundant queries
    const roleCache = {};
    const channelCache = {};

    for (const task of tasks) {
        // Handle timezone parsing natively. task.deadline is a string from DB like 'YYYY-MM-DD HH:mm:ss'
        const deadlineUtc = new Date(task.deadline.replace(' ', 'T') + 'Z');
        
        // Diff in minutes (using Math.round to ignore minor second/millisecond differences)
        const diffMs = deadlineUtc.getTime() - nowUtc.getTime();
        const diffMinutes = Math.round(diffMs / 1000 / 60);

        // Get notification channels for this guild (cached)
        if (!channelCache[task.guildId]) {
            const [channels] = await pool.query(`SELECT channelId, kelas FROM channels WHERE guildId = ?`, [task.guildId]);
            channelCache[task.guildId] = channels;
        }
        const channels = channelCache[task.guildId];
        if (channels.length === 0) continue;

        // Get role mapping for this guild (cached)
        if (!roleCache[task.guildId]) {
            const [roles] = await pool.query(`SELECT * FROM roles WHERE guildId = ?`, [task.guildId]);
            roleCache[task.guildId] = roles;
        }
        const roles = roleCache[task.guildId];

        const taskKelas = task.kelas || 'Semua';
        let targetChannelsWithRoles = []; 

        if (taskKelas === 'Semua') {
            const semuaChannel = channels.find(c => c.kelas === 'Semua');
            if (semuaChannel) {
                targetChannelsWithRoles.push({ channelId: semuaChannel.channelId, kelasToPing: 'Semua' });
            } else {
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
        if (task.status !== 'completed') {
            for (const target of targetChannelsWithRoles) {
                const channel = client.channels.cache.get(target.channelId);
                if (!channel) continue;

                const mention = buildRoleMention(target.kelasToPing, roles);
                const kelasLabel = taskKelas === 'Semua' ? '' : ` (Kelas ${taskKelas})`;

                let embed = null;
                if (diffMinutes === 72 * 60) {
                    embed = new EmbedBuilder()
                        .setTitle(`🔴 PERHATIAN! H-3 Deadline!${kelasLabel}`)
                        .setDescription(`Tugas **${task.description}** harus dikumpulkan dalam 3 hari lagi.${linkText}`);
                } else if (diffMinutes === 24 * 60) {
                    embed = new EmbedBuilder()
                        .setTitle(`❗ PENGINGAT H-1!${kelasLabel}`)
                        .setDescription(`Besok adalah batas akhir pengumpulan **${task.description}**. Segera selesaikan!${linkText}`);
                } else if (diffMinutes === 12 * 60) {
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
            await removePinnedTaskMessage(client, task.id);
            
            if (task.repeat_status === 'Once') {
                await pool.query(`UPDATE tasks SET status = 'completed' WHERE id = ? AND guildId = ?`, [task.id, task.guildId]);
            } else if (task.repeat_status === 'Weekly') {
                const nextDeadlineUtcDate = new Date(deadlineUtc.getTime() + 7 * 24 * 60 * 60 * 1000);
                const nextDeadlineUtc = nextDeadlineUtcDate.toISOString().slice(0, 19).replace('T', ' ');
                
                await pool.query(`UPDATE tasks SET deadline = ?, status = 'pending' WHERE id = ? AND guildId = ?`, [nextDeadlineUtc, task.id, task.guildId]);
                
                task.deadline = nextDeadlineUtc;
                task.status = 'pending';
                await pinTaskMessage(client, task);
            }
        }
    }
}

async function runDailyCleanup() {
    const pool = getDb();
    const thirtyDaysAgoUtc = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    
    const [result] = await pool.query(
        `DELETE FROM tasks WHERE status = 'completed' AND deadline < ?`, 
        [thirtyDaysAgoUtc]
    );
    
    if (result.affectedRows > 0) {
        console.log(`Auto-cleanup: Deleted ${result.affectedRows} completed tasks older than 30 days.`);
    }
}

async function runHourlySync(client) {
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
            
            // Cache existing tasks for this guild to prevent N+1 query problem
            const [existingTasks] = await pool.query('SELECT uid, description, deadline FROM tasks WHERE guildId = ?', [syncJob.guildId]);
            const existingUids = new Set(existingTasks.filter(t => t.uid).map(t => t.uid));
            const existingDescDates = new Set(existingTasks.map(t => `${t.description}_${t.deadline}`));
            
            for (const task of tasks) {
                let exists = false;
                if (task.uid) {
                    if (existingUids.has(task.uid)) exists = true;
                } else {
                    const desc = task.description || 'Task';
                    if (existingDescDates.has(`${desc}_${task.deadlineUtc}`)) exists = true;
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
            
            // Generate WIB timestamp string natively
            const options = { timeZone: TIMEZONE, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' };
            const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(new Date());
            const d = {};
            parts.forEach(({ type, value }) => d[type] = value);
            const nowWib = `${d.year}-${d.month}-${d.day} ${d.hour}:${d.minute}:${d.second}`;

            await pool.query('UPDATE sync_urls SET last_sync = ? WHERE id = ?', [nowWib, syncJob.id]);
            
            if (newTasksCount > 0) {
                console.log(`Auto-sync: Added ${newTasksCount} new tasks for guild ${syncJob.guildId}, kelas ${syncJob.kelas}`);
            }
        } catch (err) {
            console.error(`Error auto-syncing URL ${syncJob.url}:`, err);
        }
    }
}

module.exports = { startCronJob };
