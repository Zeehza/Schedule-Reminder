const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { getDb } = require("../database/connection");
const { formatUtcToWib } = require("../utils/time");
const { paginateReply } = require("../utils/pagination");
const moment = require("moment-timezone");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("list")
    .setDescription("Melihat Daftar Tugas yang belum melewati batas waktu")
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

      // Get current time in UTC to compare with DB
      const nowUtc = moment().utc().format("YYYY-MM-DD HH:mm:ss");

      let query = `SELECT * FROM tasks WHERE guildId = ? AND deadline > ? AND status = 'pending'`;
      const params = [guildId, nowUtc];

      if (kelasFilter) {
        query += ` AND kelas = ?`;
        params.push(kelasFilter);
      }

      query += ` ORDER BY deadline ASC`;

      const [tasks] = await pool.query(query, params);

      if (tasks.length === 0) {
        const filterText = kelasFilter
          ? ` untuk ${kelasFilter === "Semua" ? "Semua Kelas" : "Kelas " + kelasFilter}`
          : "";
        return interaction.reply({
          content: `😃 Tidak ada tugas mendatang silahkan tidur${filterText}.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const filterTitle = kelasFilter
        ? ` (${kelasFilter === "Semua" ? "Semua Kelas" : "Kelas " + kelasFilter})`
        : "";

      const embedGenerator = (currentTasks, page, totalPages, totalItems) => {
        const embed = new EmbedBuilder()
          .setTitle(`📋 Daftar Tugas Mendatang${filterTitle}`)
          .setColor(0x0099ff)
          .setFooter({
            text: `Halaman ${page} dari ${totalPages} | Total: ${totalItems} tugas`,
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
          let taskDetails = "";
          if (task.course) {
              taskDetails += `**Mata Kuliah:** ${task.course}\n`;
          }
          taskDetails += `**Deadline:** ${wibTime.dateDisplay} pukul ${wibTime.time} WIB\n`;
          taskDetails += `**Kelas:** ${kelasLabel}\n`;
          taskDetails += `**Repeat:** ${task.repeat_status}\n`;
          if (task.link) {
            let validLink = task.link;
            if (
              !validLink.startsWith("http://") &&
              !validLink.startsWith("https://")
            ) {
              validLink = "https://" + validLink;
            }
            taskDetails += `**Link:** [Buka Tautan](${validLink})\n`;
          }

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
      console.error("Error fetching list:", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Terjadi kesalahan saat mengambil daftar tugas.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};
