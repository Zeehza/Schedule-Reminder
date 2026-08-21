const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getDb } = require('../database/connection');
const { removePinnedTaskMessage } = require('../services/pinManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Hapus data tugas secara permanen')
        .addStringOption(option => 
            option.setName('id')
                .setDescription('ID Tugas (contoh: #TGS-01)')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const taskId = interaction.options.getString('id');
        const guildId = interaction.guildId;
        const pool = getDb();

        try {
            await removePinnedTaskMessage(interaction.client, taskId);

            const [result] = await pool.query(
                `DELETE FROM tasks WHERE id = ? AND guildId = ?`, 
                [taskId, guildId]
            );

            if (result.affectedRows === 0) {
                return interaction.reply({ content: `❌ Tugas dengan ID ${taskId} tidak ditemukan.`, flags: MessageFlags.Ephemeral });
            }

            await interaction.reply({ content: `✅ Tugas ${taskId} berhasil dihapus secara permanen.` });
        } catch (error) {
            console.error('Error removing task:', error);
            await interaction.reply({ content: '❌ Terjadi kesalahan saat menghapus tugas.', flags: MessageFlags.Ephemeral });
        }
    },
};
