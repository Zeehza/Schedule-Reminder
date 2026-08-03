const { getDb } = require('../database/connection');
const { EmbedBuilder } = require('discord.js');
const moment = require('moment-timezone');

/**
 * Send and pin a task message in the respective channel
 */
async function pinTaskMessage(client, task) {
    const pool = getDb();

    try {
        // Get target channels based on task.kelas and guild
        const [channels] = await pool.query(`SELECT channelId, kelas FROM channels WHERE guildId = ?`, [task.guildId]);
        if (channels.length === 0) return;

        let targetChannelIds = [];
        if (task.kelas === 'Semua') {
            const semuaChannel = channels.find(c => c.kelas === 'Semua');
            if (semuaChannel) {
                targetChannelIds.push(semuaChannel.channelId);
            } else {
                const aChannel = channels.find(c => c.kelas === 'A');
                const bChannel = channels.find(c => c.kelas === 'B');
                if (aChannel) targetChannelIds.push(aChannel.channelId);
                if (bChannel) targetChannelIds.push(bChannel.channelId);
            }
        } else {
            const specificChannel = channels.find(c => c.kelas === task.kelas);
            if (specificChannel) {
                targetChannelIds.push(specificChannel.channelId);
            } else {
                const semuaChannel = channels.find(c => c.kelas === 'Semua');
                if (semuaChannel) targetChannelIds.push(semuaChannel.channelId);
            }
        }

        if (targetChannelIds.length === 0) return;

        // Get roles for mentions
        const [roles] = await pool.query(`SELECT * FROM roles WHERE guildId = ?`, [task.guildId]);
        const roleMap = {};
        for (const r of roles) roleMap[r.kelas] = r.roleId;

        let roleMention = '';
        if (task.kelas === 'A' && roleMap['A']) {
            roleMention = `<@&${roleMap['A']}>`;
        } else if (task.kelas === 'B' && roleMap['B']) {
            roleMention = `<@&${roleMap['B']}>`;
        } else if (task.kelas === 'Semua') {
            const mentions = [];
            if (roleMap['A']) mentions.push(`<@&${roleMap['A']}>`);
            if (roleMap['B']) mentions.push(`<@&${roleMap['B']}>`);
            roleMention = mentions.length > 0 ? mentions.join(' ') : '@everyone';
        }

        const deadlineWib = moment.utc(task.deadline).tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm');
        const kelasLabel = task.kelas === 'Semua' ? 'Semua Kelas' : `Kelas ${task.kelas}`;
        let linkText = task.link ? `\n🔗 Link: ${task.link}` : '';
        const embed = new EmbedBuilder()
            .setTitle(`📢 Tugas Baru untuk ${kelasLabel}!`)
            .setColor('#9400d3')
            .addFields(
                { name: 'ID', value: `**${task.id}**`, inline: true },
                { name: 'Deadline', value: `**${deadlineWib} WIB**`, inline: true },
                { name: 'Deskripsi', value: task.description || 'Tidak ada deskripsi' }
            )
            .setTimestamp();

        if (task.link) {
            embed.addFields({ name: 'Link', value: task.link });
        }

        for (const channelId of targetChannelIds) {
            try {
                const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId);
                if (channel) {
                    const msg = await channel.send({ content: roleMention, embeds: [embed] });
                    await msg.pin();

                    // Try to delete the system "pinned a message" message to keep it clean
                    channel.messages.fetch({ limit: 5 }).then(messages => {
                        const systemMsg = messages.find(m => m.type === 6 && m.author.id === client.user.id);
                        if (systemMsg) systemMsg.delete().catch(() => { });
                    }).catch(() => { });

                    // Save to database
                    await pool.query(
                        `INSERT INTO pinned_messages (taskId, channelId, messageId) VALUES (?, ?, ?)`,
                        [task.id, channelId, msg.id]
                    );
                }
            } catch (err) {
                console.error(`Gagal mengirim/pin pesan di channel ${channelId}:`, err);
            }
        }
    } catch (err) {
        console.error('Error in pinTaskMessage:', err);
    }
}

/**
 * Unpin/Delete task messages
 */
async function removePinnedTaskMessage(client, taskId) {
    const pool = getDb();

    try {
        const [rows] = await pool.query(`SELECT channelId, messageId FROM pinned_messages WHERE taskId = ?`, [taskId]);
        for (const row of rows) {
            try {
                const channel = client.channels.cache.get(row.channelId) || await client.channels.fetch(row.channelId);
                if (channel) {
                    const msg = await channel.messages.fetch(row.messageId);
                    if (msg) {
                        await msg.delete(); // Deleting also unpins it automatically
                    }
                }
            } catch (err) {
                // If message is already deleted or not found, just ignore
                if (err.code !== 10008) {
                    console.error(`Gagal menghapus pesan pinned untuk task ${taskId} di channel ${row.channelId}:`, err);
                }
            }
        }

        await pool.query(`DELETE FROM pinned_messages WHERE taskId = ?`, [taskId]);
    } catch (err) {
        console.error(`Gagal query pinned_messages untuk task ${taskId}:`, err);
    }
}

module.exports = { pinTaskMessage, removePinnedTaskMessage };
