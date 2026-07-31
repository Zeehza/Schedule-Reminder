const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getDb } = require('../database/connection');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('repeat')
        .setDescription('Mengatur pengulangan tugas')
        .addStringOption(option => 
            option.setName('id')
                .setDescription('ID Tugas (contoh: #TGS-01)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('status')
                .setDescription('Pilih status pengulangan')
                .setRequired(true)
                .addChoices(
                    { name: 'Sekali (Once)', value: 'Once' },
                    { name: 'Mingguan (Weekly)', value: 'Weekly' }
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const taskId = interaction.options.getString('id');
        const status = interaction.options.getString('status');
        const guildId = interaction.guildId;
        const pool = getDb();

        try {
            const [result] = await pool.query(
                `UPDATE tasks SET repeat_status = ? WHERE id = ? AND guildId = ?`,
                [status, taskId, guildId]
            );

            if (result.affectedRows === 0) {
                return interaction.reply({ content: `❌ Tugas dengan ID ${taskId} tidak ditemukan.`, ephemeral: true });
            }

            await interaction.reply({ content: `✅ Status pengulangan tugas ${taskId} diubah menjadi **${status}**.` });
        } catch (error) {
            console.error('Error updating repeat status:', error);
            await interaction.reply({ content: '❌ Terjadi kesalahan saat mengubah status pengulangan.', ephemeral: true });
        }
    },
};
