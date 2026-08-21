const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Menampilkan daftar perintah dan panduan penggunaan bot'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('Panduan Penggunaan Bot Pengingat Tugas')
            .setColor('#9400d3')
            .setDescription('Berikut adalah daftar perintah yang tersedia pada bot ini:')
            .addFields(
                {
                    name: 'Konfigurasi & Setup (Admin)',
                    value: '`/setchannel` - Mengatur channel tempat bot mengirim notifikasi tugas.\n' +
                        '`/setrole` - Mengatur role Discord untuk masing-masing kelas (A atau B) untuk mention.\n' +
                        '`/addschedule` - Mengimpor daftar tugas sekaligus dari file `.ics`.'
                },
                {
                    name: ' Manajemen Tugas (Admin)',
                    value: '`/new` - Menambahkan tugas/deadline baru secara manual.\n' +
                        '`/edit` - Mengubah detail tugas yang sudah ada (deskripsi, deadline, link).\n' +
                        '`/done` - Menandai tugas sebagai selesai.\n' +
                        '`/remove` - Menghapus tugas dari database secara permanen.\n' +
                        '`/repeat` - Mengatur tugas agar berulang setiap minggu (`Weekly`).'
                },
                {
                    name: ' Umum',
                    value: '`/list` - Melihat daftar seluruh tugas yang belum selesai.\n' +
                        '`/history` - Melihat riwayat tugas yang sudah diselesaikan.\n' +
                        '`/help` - Menampilkan panduan ini.'
                },
                {
                    name: ' Tips',
                    value: 'Semua tugas yang dibuat akan otomatis dipin di channel yang sesuai. Saat waktu deadline sudah lewat, pesan pin akan dihapus secara otomatis agar channel tetap rapi.'
                }
            )
            .setFooter({ text: 'Schedule Reminder Bot by Zeehza', iconURL: interaction.client.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};
