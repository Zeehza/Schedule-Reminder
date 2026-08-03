const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getDb } = require('../database/connection');
const { parseICS } = require('../services/icsParser');
const { generateTaskId } = require('../utils/time');
const { pinTaskMessage } = require('../services/pinManager');
const https = require('https');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addschedule')
        .setDescription('Import tasks from an ICS file')
        .addAttachmentOption(option => 
            option.setName('file')
                .setDescription('The .ics file to import')
                .setRequired(true)
        )
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
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const attachment = interaction.options.getAttachment('file');
        const kelas = interaction.options.getString('kelas');

        if (!attachment.name.endsWith('.ics')) {
            return interaction.reply({ content: '❌ Harap lampirkan file dengan format .ics!', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: false });

        https.get(attachment.url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', async () => {
                try {
                    const tasks = parseICS(data);
                    
                    if (tasks.length === 0) {
                        return interaction.editReply({ content: '❌ Tidak ada tugas yang valid ditemukan dalam file ICS.' });
                    }

                    const pool = getDb();
                    const guildId = interaction.guildId;
                    
                    for (const task of tasks) {
                        const taskId = generateTaskId();
                        await pool.query(
                            `INSERT INTO tasks (id, guildId, description, deadline, link, repeat_status, kelas) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [taskId, guildId, task.description || 'Task', task.deadlineUtc, task.link, 'Once', kelas]
                        );

                        await pinTaskMessage(interaction.client, {
                            id: taskId,
                            guildId,
                            description: task.description || 'Task',
                            deadline: task.deadlineUtc,
                            link: task.link,
                            kelas
                        });
                    }

                    // Build role mention for reply
                    let roleMention = '';
                    const [roles] = await pool.query(`SELECT * FROM roles WHERE guildId = ?`, [guildId]);
                    const roleMap = {};
                    for (const r of roles) roleMap[r.kelas] = r.roleId;

                    if (kelas === 'A' && roleMap['A']) {
                        roleMention = `<@&${roleMap['A']}>`;
                    } else if (kelas === 'B' && roleMap['B']) {
                        roleMention = `<@&${roleMap['B']}>`;
                    } else if (kelas === 'Semua') {
                        const mentions = [];
                        if (roleMap['A']) mentions.push(`<@&${roleMap['A']}>`);
                        if (roleMap['B']) mentions.push(`<@&${roleMap['B']}>`);
                        roleMention = mentions.length > 0 ? mentions.join(' ') : '@everyone';
                    }

                    const kelasLabel = kelas === 'Semua' ? 'Semua Kelas' : `Kelas ${kelas}`;
                    await interaction.editReply({
                        content: `${roleMention} ✅ Berhasil mengimpor ${tasks.length} deadline tugas dari file ICS untuk **${kelasLabel}**.`
                    });
                } catch (error) {
                    console.error('Error importing ICS:', error);
                    await interaction.editReply({ content: '❌ Terjadi kesalahan saat memproses file ICS.' });
                }
            });
        }).on('error', async (err) => {
            console.error('Error downloading ICS:', err);
            await interaction.editReply({ content: '❌ Gagal mengunduh file lampiran.' });
        });
    },
};
