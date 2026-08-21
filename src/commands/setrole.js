const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getDb } = require('../database/connection');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setrole')
        .setDescription('Set role untuk Kelas A atau B (untuk notifikasi)')
        .addStringOption(option =>
            option.setName('kelas')
                .setDescription('Pilih kelas')
                .setRequired(true)
                .addChoices(
                    { name: 'Kelas A', value: 'A' },
                    { name: 'Kelas B', value: 'B' }
                )
        )
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Role Discord untuk kelas ini')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const kelas = interaction.options.getString('kelas');
        const role = interaction.options.getRole('role');
        const guildId = interaction.guildId;

        try {
            const pool = getDb();
            await pool.query(
                `INSERT INTO roles (guildId, kelas, roleId) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE roleId = ?`,
                [guildId, kelas, role.id, role.id]
            );

            await interaction.reply({
                content: `✅ Role untuk **Kelas ${kelas}** berhasil diatur ke <@&${role.id}>.`,
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Error setting role:', error);
            await interaction.reply({ content: '❌ Terjadi kesalahan saat menyimpan role.', flags: MessageFlags.Ephemeral });
        }
    },
};
