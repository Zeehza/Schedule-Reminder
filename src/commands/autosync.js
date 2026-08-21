const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");
const { getDb } = require("../database/connection");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("autosync")
    .setDescription("Mengatur auto-sync untuk jadwal dari URL ICS")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Tambahkan URL ICS untuk disinkronisasi otomatis")
        .addStringOption((option) =>
          option
            .setName("url")
            .setDescription("URL dari file .ics")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("kelas")
            .setDescription("Kelas tujuan tugas ini")
            .setRequired(true)
            .addChoices(
              { name: "Kelas A", value: "A" },
              { name: "Kelas B", value: "B" },
              { name: "Semua Kelas", value: "Semua" },
            ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("Melihat daftar URL ICS yang sedang disinkronisasi"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Menghapus sinkronisasi URL ICS")
        .addIntegerOption((option) =>
          option
            .setName("id")
            .setDescription("ID sinkronisasi (lihat di /autosync list)")
            .setRequired(true),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const pool = getDb();
    const guildId = interaction.guildId;
    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === "add") {
        const url = interaction.options.getString("url");
        const kelas = interaction.options.getString("kelas");

        try {
          new URL(url);
          if (!url.startsWith("http://") && !url.startsWith("https://")) {
            throw new Error('Not HTTP');
          }
        } catch (err) {
          return interaction.reply({
            content: "❌ URL tidak valid! Harap masukkan URL yang benar dengan http:// atau https://",
            flags: MessageFlags.Ephemeral,
          });
        }

        await pool.query(
          `INSERT INTO sync_urls (guildId, url, kelas) VALUES (?, ?, ?)`,
          [guildId, url, kelas],
        );

        await interaction.reply({
          content: `✅ Berhasil menambahkan URL untuk disinkronisasi ke **Kelas ${kelas}**! Bot akan mengecek tugas baru setiap jam.`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (subcommand === "list") {
        const [urls] = await pool.query(
          `SELECT * FROM sync_urls WHERE guildId = ?`,
          [guildId],
        );

        if (urls.length === 0) {
          return interaction.reply({
            content: "❌ Belum ada URL yang disinkronisasi untuk server ini.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const embed = new EmbedBuilder()
          .setTitle("Daftar Sinkronisasi Otomatis")
          .setColor(0x00ff00)
          .setTimestamp();

        urls.forEach((u) => {
          const lastSync = u.last_sync
            ? u.last_sync
            : "Belum pernah disinkronisasi";
          embed.addFields({
            name: `ID: ${u.id} | Kelas: ${u.kelas}`,
            value: `**URL:** ${u.url}\n**Terakhir Sync:** ${lastSync}`,
          });
        });

        await interaction.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        });
      } else if (subcommand === "remove") {
        const id = interaction.options.getInteger("id");

        const [result] = await pool.query(
          `DELETE FROM sync_urls WHERE id = ? AND guildId = ?`,
          [id, guildId],
        );

        if (result.affectedRows === 0) {
          return interaction.reply({
            content: `❌ Data sinkronisasi dengan ID ${id} tidak ditemukan.`,
            flags: MessageFlags.Ephemeral,
          });
        }

        await interaction.reply({
          content: `✅ Sinkronisasi ID ${id} berhasil dihapus.`,
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (error) {
      console.error("Error handling autosync command:", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Terjadi kesalahan saat memproses perintah autosync.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};
