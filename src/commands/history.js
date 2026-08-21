const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { getDb } = require("../database/connection");
const { formatUtcToWib } = require("../utils/time");
const { paginateReply } = require("../utils/pagination");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("history")
    .setDescription("Melihat riwayat tugas yang sudah diselesaikan")
    .addStringOption((option) =>
      option
        .setName("kelas")
        .setDescription("Filter berdasarkan kelas (kosongkan untuk semua)")
        .setRequired(false)
        .addChoices(
          { name: "Kelas A", value: "A" },
          { name: "Kelas B", value: "B" },
          { name: "Semua Kelas", value: "Semua" },
        ),
    ),

  async execute(interaction) {
    try {
      const pool = getDb();
      const guildId = interaction.guildId;
      const kelasFilter = interaction.options.getString("kelas");

      let query = `SELECT * FROM tasks WHERE guildId = ? AND status = 'completed'`;
      const params = [guildId];

      if (kelasFilter) {
        query += ` AND kelas = ?`;
        params.push(kelasFilter);
      }

      query += ` ORDER BY deadline DESC LIMIT 50`; // Limit to 50 for history to prevent massive queries

      const [tasks] = await pool.query(query, params);

      if (tasks.length === 0) {
        const filterText = kelasFilter
          ? ` untuk ${kelasFilter === "Semua" ? "Semua Kelas" : "Kelas " + kelasFilter}`
          : "";
        return interaction.reply({
          content: `Belum ada tugas yang diselesaikan${filterText}.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const filterTitle = kelasFilter
        ? ` (${kelasFilter === "Semua" ? "Semua Kelas" : "Kelas " + kelasFilter})`
        : "";

      const embedGenerator = (currentTasks, page, totalPages, totalItems) => {
        const embed = new EmbedBuilder()
          .setTitle(`✅ Riwayat Tugas Selesai${filterTitle}`)
          .setColor(0x00ff00)
          .setFooter({
            text: `Halaman ${page} dari ${totalPages} | Total: ${totalItems} tugas (Maksimal 50 terbaru)`,
          })
          .setTimestamp();

        currentTasks.forEach((task) => {
          const wibTime = formatUtcToWib(task.deadline);
          const kelasLabel =
            task.kelas === "Semua"
              ? "📢 Semua"
              : task.kelas === "A"
                ? "Kelas A"
                : "Kelas B";
          let taskDetails = `**Deskripsi:** ${task.description}\n`;
          taskDetails += `**Deadline:** ${wibTime.dateDisplay} pukul ${wibTime.time} WIB\n`;
          taskDetails += `**Kelas:** ${kelasLabel}\n`;

          embed.addFields({
            name: `ID: ${task.id}`,
            value: taskDetails,
            inline: false,
          });
        });

        return embed;
      };

      await paginateReply(interaction, tasks, 5, embedGenerator, true);
    } catch (error) {
      console.error("Error fetching history:", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Terjadi kesalahan saat mengambil riwayat tugas.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};
