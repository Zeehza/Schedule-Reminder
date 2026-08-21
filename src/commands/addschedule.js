const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getDb } = require('../database/connection');
const { parseICS } = require('../services/icsParser');
const { generateTaskId } = require('../utils/time');
const { pinTaskMessage } = require('../services/pinManager');
const { buildRoleMention } = require('../utils/role');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addschedule')
        .setDescription('Import tasks from an ICS file or URL')
        .addStringOption(option =>
            option.setName('kelas')
                .setDescription('Kelas tujuan tugas ini')
                .setRequired(true)
                .addChoices(
                    { name: 'Kelas A', value: 'A' },
                    { name: 'Kelas B', value: 'B' },
                    { name: 'Semua Kelas', value: 'Semua' }
                )
        )
        .addAttachmentOption(option => 
            option.setName('file')
                .setDescription('The .ics file to import')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('url')
                .setDescription('The URL of the .ics file to import')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const attachment = interaction.options.getAttachment('file');
        const urlInput = interaction.options.getString('url');
        const kelas = interaction.options.getString('kelas');

        if (!attachment && !urlInput) {
            return interaction.reply({ content: '❌ Harap lampirkan file .ics atau berikan URL .ics!', flags: MessageFlags.Ephemeral });
        }

        let downloadUrl = '';
        if (attachment) {
            if (!attachment.name.endsWith('.ics')) {
                return interaction.reply({ content: '❌ Harap lampirkan file dengan format .ics!', flags: MessageFlags.Ephemeral });
            }
            downloadUrl = attachment.url;
        } else if (urlInput) {
            try {
                new URL(urlInput);
                if (!urlInput.startsWith('http://') && !urlInput.startsWith('https://')) {
                    throw new Error('Not HTTP');
                }
            } catch (err) {
                return interaction.reply({ content: '❌ URL tidak valid! Harap masukkan URL yang benar dengan http:// atau https://', flags: MessageFlags.Ephemeral });
            }
            downloadUrl = urlInput;
        }

        await interaction.deferReply({ });

        try {
            const response = await fetch(downloadUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.text();

            const tasks = parseICS(data);
            
            if (tasks.length === 0) {
                return interaction.editReply({ content: '❌ Tidak ada tugas yang valid ditemukan dalam file ICS.' });
            }

            const pool = getDb();
            const guildId = interaction.guildId;
            
            let newTasksCount = 0;
            for (const task of tasks) {
                // Check for duplicates
                let exists = false;
                if (task.uid) {
                    const [existing] = await pool.query(
                        'SELECT id FROM tasks WHERE guildId = ? AND uid = ?',
                        [guildId, task.uid]
                    );
                    if (existing.length > 0) exists = true;
                } else {
                    const [existing] = await pool.query(
                        'SELECT id FROM tasks WHERE guildId = ? AND description = ? AND deadline = ?',
                        [guildId, task.description || 'Task', task.deadlineUtc]
                    );
                    if (existing.length > 0) exists = true;
                }

                if (!exists) {
                    const taskId = generateTaskId();
                    await pool.query(
                        `INSERT INTO tasks (id, guildId, uid, description, deadline, link, repeat_status, kelas) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [taskId, guildId, task.uid || null, task.description || 'Task', task.deadlineUtc, task.link, 'Once', kelas]
                    );

                    await pinTaskMessage(interaction.client, {
                        id: taskId,
                        guildId,
                        description: task.description || 'Task',
                        deadline: task.deadlineUtc,
                        link: task.link,
                        kelas
                    });
                    newTasksCount++;
                }
            }

            // Build role mention for reply
            const [roles] = await pool.query(`SELECT * FROM roles WHERE guildId = ?`, [guildId]);
            const roleMention = buildRoleMention(kelas, roles);

            const kelasLabel = kelas === 'Semua' ? 'Semua Kelas' : `Kelas ${kelas}`;
            await interaction.editReply({
                content: `${roleMention} ✅ Berhasil mengimpor ${newTasksCount} tugas baru dari file ICS untuk **${kelasLabel}**. (Total di file: ${tasks.length}, Duplikat diabaikan).`
            });
        } catch (error) {
            console.error('Error importing ICS:', error);
            await interaction.editReply({ content: '❌ Terjadi kesalahan saat mengunduh atau memproses file ICS.' });
        }
    },
};
