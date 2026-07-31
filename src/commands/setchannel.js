const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
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
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const guildId = interaction.guildId;

        // Check bot permissions in target channel
        const botMember = interaction.guild.members.me;
        const permissions = channel.permissionsFor(botMember);
        
        if (!permissions.has(PermissionFlagsBits.SendMessages) || !permissions.has(PermissionFlagsBits.ViewChannel)) {
            return interaction.reply({ 
                content: `❌ I do not have permission to send messages or view <#${channel.id}>.`, 
                ephemeral: true 
            });
        }

        try {
            const pool = getDb();
            // Upsert channel info
            await pool.query(
                `INSERT INTO channels (guildId, channelId) VALUES (?, ?) 
                 ON DUPLICATE KEY UPDATE channelId = ?`, 
                [guildId, channel.id, channel.id]
            );

            await interaction.reply({ 
                content: `✅ Channel notifikasi deadline berhasil diatur ke <#${channel.id}>.`, 
                ephemeral: true 
            });
        } catch (error) {
            console.error('Database error in setchannel:', error);
            await interaction.reply({ content: '❌ Terjadi kesalahan saat menyimpan pengaturan channel.', ephemeral: true });
        }
    },
};
