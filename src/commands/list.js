const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDb } = require('../database/connection');
const { formatUtcToWib } = require('../utils/time');
const moment = require('moment-timezone');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list')
        .setDescription('Melihat Daftar Tugas yang belum melewati batas waktu')
        .addStringOption(option =>
            option.setName('kelas')
                .setDescription('Filter berdasarkan kelas (kosongkan untuk semua)')
                .setRequired(false)
                .addChoices(
                    { name: 'Kelas A', value: 'A' },
                    { name: 'Kelas B', value: 'B' },
                    { name: 'Semua Kelas', value: 'Semua' }
                )
        ),

    async execute(interaction) {
        try {
            const pool = getDb();
            const guildId = interaction.guildId;
            const kelasFilter = interaction.options.getString('kelas');

            // Get current time in UTC to compare with DB
            const nowUtc = moment().utc().format('YYYY-MM-DD HH:mm:ss');

            let query = `SELECT * FROM tasks WHERE guildId = ? AND deadline > ?`;
            const params = [guildId, nowUtc];

            if (kelasFilter) {
                query += ` AND kelas = ?`;
                params.push(kelasFilter);
            }

            query += ` ORDER BY deadline ASC`;

            const [tasks] = await pool.query(query, params);

            if (tasks.length === 0) {
                const filterText = kelasFilter ? ` untuk ${kelasFilter === 'Semua' ? 'Semua Kelas' : 'Kelas ' + kelasFilter}` : '';
                return interaction.reply({ content: `😃 Tidak ada tugas mendatang${filterText}.`, ephemeral: false });
            }

            const filterTitle = kelasFilter ? ` (${kelasFilter === 'Semua' ? 'Semua Kelas' : 'Kelas ' + kelasFilter})` : '';
            const embed = new EmbedBuilder()
                .setTitle(`📋 Daftar Tugas Mendatang${filterTitle}`)
                .setColor(0x0099FF)
                .setTimestamp();

            tasks.forEach(task => {
                const wibTime = formatUtcToWib(task.deadline);
                const kelasLabel = task.kelas === 'Semua' ? '📢 Semua' : (task.kelas === 'A' ? '🅰️ Kelas A' : '🅱️ Kelas B');
                let taskDetails = `**Deskripsi:** ${task.description}\n`;
                taskDetails += `**Deadline:** ${wibTime.dateDisplay} pukul ${wibTime.time} WIB\n`;
                taskDetails += `**Kelas:** ${kelasLabel}\n`;
                taskDetails += `**Repeat:** ${task.repeat_status}\n`;
                if (task.link) {
                    let validLink = task.link;
                    if (!validLink.startsWith('http://') && !validLink.startsWith('https://')) {
                        validLink = 'https://' + validLink;
                    }
                    taskDetails += `**Link:** [Buka Tautan](${validLink})\n`;
                }

                embed.addFields({
                    name: `ID: ${task.id}`,
                    value: taskDetails,
                    inline: false
                });
            });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching list:', error);
            await interaction.reply({ content: '❌ Terjadi kesalahan saat mengambil daftar tugas.', ephemeral: true });
        }
    },
};
