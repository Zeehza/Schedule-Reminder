const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getDb } = require('../database/connection');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setchannel')
        .setDescription('Set the channel for deadline notifications')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('The channel to send notifications to')
                .setRequired(true)
        )
        .addStringOption(option => 
            option.setName('kelas')
                .setDescription('Pilih kelas untuk channel ini')
                .setRequired(true)
                .addChoices(
                    { name: 'Kelas A', value: 'A' },
                    { name: 'Kelas B', value: 'B' },
                    { name: 'Semua', value: 'Semua' }
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const kelas = interaction.options.getString('kelas');
        const guildId = interaction.guildId;

        // Check bot permissions in target channel
        const botMember = interaction.guild.members.me;
        const permissions = channel.permissionsFor(botMember);
        
        if (!permissions.has(PermissionFlagsBits.SendMessages) || !permissions.has(PermissionFlagsBits.ViewChannel)) {
            return interaction.reply({ 
                content: `❌ I do not have permission to send messages or view <#${channel.id}>.`, 
                flags: MessageFlags.Ephemeral 
            });
        }

        try {
            const pool = getDb();
            // Upsert channel info
            await pool.query(
                `INSERT INTO channels (guildId, kelas, channelId) VALUES (?, ?, ?) 
                 ON DUPLICATE KEY UPDATE channelId = ?`, 
                [guildId, kelas, channel.id, channel.id]
            );

            await interaction.reply({ 
                content: `✅ Channel notifikasi deadline untuk kelas **${kelas}** berhasil diatur ke <#${channel.id}>.`, 
                flags: MessageFlags.Ephemeral 
            });
        } catch (error) {
            console.error('Database error in setchannel:', error);
            await interaction.reply({ content: '❌ Terjadi kesalahan saat menyimpan pengaturan channel.', flags: MessageFlags.Ephemeral });
        }
    },
};
