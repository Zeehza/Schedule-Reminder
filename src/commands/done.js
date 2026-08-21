const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { getDb } = require("../database/connection");
const { removePinnedTaskMessage } = require("../services/pinManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("done")
    .setDescription("Tandai tugas sebagai selesai (Mark as Done)")
    .addStringOption((option) =>
      option
        .setName("id")
        .setDescription("ID Tugas (contoh: #TGS-01)")
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const taskId = interaction.options.getString("id");
    const guildId = interaction.guildId;
    const pool = getDb();

    try {
      // Unpin the message if it exists
      await removePinnedTaskMessage(interaction.client, taskId);

      const [result] = await pool.query(
        `UPDATE tasks SET status = 'completed' WHERE id = ? AND guildId = ? AND status = 'pending'`,
        [taskId, guildId],
      );

      if (result.affectedRows === 0) {
        return interaction.reply({
          content: `❌ Tugas dengan ID ${taskId} tidak ditemukan atau sudah selesai.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.reply({
        content: `✅ Tugas **${taskId}** berhasil ditandai sebagai selesai!`,
      });
    } catch (error) {
      console.error("Error marking task as done:", error);
      await interaction.reply({
        content: "❌ Terjadi kesalahan saat memproses tugas.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
