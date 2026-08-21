const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { getDb } = require('../database/connection');
const { parseWibToUtcString, formatUtcToWib } = require('../utils/time');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('edit')
        .setDescription('Ubah detail tugas')
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
            const [rows] = await pool.query(`SELECT * FROM tasks WHERE id = ? AND guildId = ?`, [taskId, guildId]);
            if (rows.length === 0) {
                return interaction.reply({ content: `❌ Tugas dengan ID ${taskId} tidak ditemukan.`, flags: MessageFlags.Ephemeral });
            }

            const task = rows[0];
            const currentKelas = task.kelas || 'Semua';

            // Step 1: Show select menu for kelas selection
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`editTaskKelasSelect_${taskId}`)
                .setPlaceholder('Pilih kelas tujuan tugas...')
                .addOptions([
                    { label: 'Kelas A', value: 'A', default: currentKelas === 'A' },
                    { label: 'Kelas B', value: 'B', default: currentKelas === 'B' },
                    { label: 'Semua Kelas', value: 'Semua', emoji: '📢', default: currentKelas === 'Semua' },
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.reply({
                content: `📋 **Pilih kelas tujuan untuk tugas ${taskId}:**\n_(Kelas saat ini: **${currentKelas === 'Semua' ? 'Semua Kelas' : 'Kelas ' + currentKelas}**)_`,
                components: [row],
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Error in edit command:', error);
            await interaction.reply({ content: '❌ Terjadi kesalahan saat mengambil data tugas.', flags: MessageFlags.Ephemeral });
        }
    },

    // Step 2: Handle kelas selection -> show edit modal
    async handleKelasSelect(interaction) {
        const customId = interaction.customId; // 'editTaskKelasSelect_#TGS-01'
        const taskId = customId.replace('editTaskKelasSelect_', '');
        const kelas = interaction.values[0];
        const guildId = interaction.guildId;
        const pool = getDb();

        try {
            const [rows] = await pool.query(`SELECT * FROM tasks WHERE id = ? AND guildId = ?`, [taskId, guildId]);
            if (rows.length === 0) {
                return interaction.reply({ content: `❌ Tugas dengan ID ${taskId} tidak ditemukan.`, flags: MessageFlags.Ephemeral });
            }

            const task = rows[0];
            const wibTime = formatUtcToWib(task.deadline);

            const modal = new ModalBuilder()
                .setCustomId(`editTaskModal_${taskId}_${kelas}`)
                .setTitle(`Edit Tugas ${taskId}`);

            const timeInput = new TextInputBuilder()
                .setCustomId('timeInput')
                .setLabel('Jam (WIB)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue(wibTime.time)
                .setMaxLength(5);

            const dateInput = new TextInputBuilder()
                .setCustomId('dateInput')
                .setLabel('Tanggal')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue(wibTime.date)
                .setMaxLength(10);

            const descInput = new TextInputBuilder()
                .setCustomId('descInput')
                .setLabel('Deskripsi')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setValue(task.description || '');

            const linkInput = new TextInputBuilder()
                .setCustomId('linkInput')
                .setLabel('Link (opsional)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            if (task.link) {
                linkInput.setValue(task.link);
            }

            modal.addComponents(
                new ActionRowBuilder().addComponents(timeInput),
                new ActionRowBuilder().addComponents(dateInput),
                new ActionRowBuilder().addComponents(descInput),
                new ActionRowBuilder().addComponents(linkInput)
            );

            await interaction.showModal(modal);
        } catch (error) {
            console.error('Error showing edit modal:', error);
            await interaction.reply({ content: '❌ Terjadi kesalahan saat mengambil data tugas.', flags: MessageFlags.Ephemeral });
        }
    },

    // Step 3: Handle modal submit
    async handleModal(interaction) {
        const customId = interaction.customId; // 'editTaskModal_#TGS-01_A'
        const parts = customId.split('_');
        const taskId = parts[1];
        const kelas = parts[2];

        const timeStr = interaction.fields.getTextInputValue('timeInput');
        const dateStr = interaction.fields.getTextInputValue('dateInput');
        const description = interaction.fields.getTextInputValue('descInput') || 'Tanpa Deskripsi';
        const link = interaction.fields.getTextInputValue('linkInput') || null;

        try {
            if (!/^\d{2}\.\d{2}$/.test(timeStr) || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
                return interaction.reply({ content: '❌ Format waktu atau tanggal tidak valid!', flags: MessageFlags.Ephemeral });
            }

            const deadlineUtc = parseWibToUtcString(dateStr, timeStr);
            if (deadlineUtc === 'Invalid date') {
                return interaction.reply({ content: '❌ Tanggal/waktu tidak valid atau sudah lewat formatnya!', flags: MessageFlags.Ephemeral });
            }

            const pool = getDb();
            const guildId = interaction.guildId;

            await pool.query(
                `UPDATE tasks SET description = ?, deadline = ?, link = ?, kelas = ? WHERE id = ? AND guildId = ?`,
                [description, deadlineUtc, link, kelas, taskId, guildId]
            );

            const kelasLabel = kelas === 'Semua' ? 'Semua Kelas' : `Kelas ${kelas}`;
            await interaction.reply({ content: `✅ Tugas ${taskId} berhasil diubah. (Kelas: **${kelasLabel}**)` });
        } catch (error) {
            console.error('Error handling edit task modal:', error);
            await interaction.reply({ content: '❌ Terjadi kesalahan saat menyimpan perubahan.', flags: MessageFlags.Ephemeral });
        }
    }
};
