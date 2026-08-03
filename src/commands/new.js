const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getDb } = require('../database/connection');
const { parseWibToUtcString, generateTaskId } = require('../utils/time');
const { pinTaskMessage } = require('../services/pinManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('new')
        .setDescription('Create a new task deadline manually')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Step 1: Show select menu for kelas selection
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('newTaskKelasSelect')
            .setPlaceholder('Pilih kelas')
            .addOptions([
                { label: 'Kelas A', value: 'A', },
                { label: 'Kelas B', value: 'B', },
                { label: 'Semua Kelas', value: 'Semua', },
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            content: '**Pilih kelas :**',
            components: [row],
            ephemeral: true
        });
    },

    // Step 2: Handle kelas selection -> show modal
    async handleKelasSelect(interaction) {
        const kelas = interaction.values[0]; // 'A', 'B', or 'Semua'

        const modal = new ModalBuilder()
            .setCustomId(`newTaskModal_${kelas}`)
            .setTitle('Input Tugas Manual');

        // Jam (Format HH.MM)
        const timeInput = new TextInputBuilder()
            .setCustomId('timeInput')
            .setLabel('Jam (WIB) - Format HH.MM')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(5)
            .setPlaceholder('23.59');

        // Tanggal (Format DD/MM/YYYY)
        const dateInput = new TextInputBuilder()
            .setCustomId('dateInput')
            .setLabel('Tanggal - Format DD/MM/YYYY')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(10)
            .setPlaceholder('31/12/2026');

        // Deskripsi
        const descInput = new TextInputBuilder()
            .setCustomId('descInput')
            .setLabel('Deskripsi (Mata kuliah/judul tugas)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder('Masukan nama mata kuliah atau judul tugas');

        // Link
        const linkInput = new TextInputBuilder()
            .setCustomId('linkInput')
            .setLabel('Link (opsional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('Masukan link pengumpulan tugas atau link kelas');

        modal.addComponents(
            new ActionRowBuilder().addComponents(timeInput),
            new ActionRowBuilder().addComponents(dateInput),
            new ActionRowBuilder().addComponents(descInput),
            new ActionRowBuilder().addComponents(linkInput)
        );

        await interaction.showModal(modal);
    },

    // Step 3: Handle modal submit
    async handleModal(interaction) {
        const customId = interaction.customId; // 'newTaskModal_A', 'newTaskModal_B', 'newTaskModal_Semua'
        const kelas = customId.split('_')[1]; // 'A', 'B', or 'Semua'

        const timeStr = interaction.fields.getTextInputValue('timeInput');
        const dateStr = interaction.fields.getTextInputValue('dateInput');
        const description = interaction.fields.getTextInputValue('descInput') || 'Tanpa Deskripsi';
        const link = interaction.fields.getTextInputValue('linkInput') || null;

        try {
            // Regex validation
            if (!/^\d{2}\.\d{2}$/.test(timeStr) || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
                return interaction.reply({ content: '❌ Format waktu atau tanggal tidak valid!', ephemeral: true });
            }

            const deadlineUtc = parseWibToUtcString(dateStr, timeStr);
            if (deadlineUtc === 'Invalid date') {
                return interaction.reply({ content: '❌ Tanggal/waktu tidak valid atau Tanggal sudah lewat!', ephemeral: true });
            }

            const taskId = generateTaskId();
            const guildId = interaction.guildId;

            const pool = getDb();
            await pool.query(
                `INSERT INTO tasks (id, guildId, description, deadline, link, repeat_status, kelas) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [taskId, guildId, description, deadlineUtc, link, 'Once', kelas]
            );

            // Pin message
            await pinTaskMessage(interaction.client, {
                id: taskId,
                guildId,
                description,
                deadline: deadlineUtc,
                link,
                kelas
            });

            // Build role mention
            let roleMention = '';
            const [roles] = await pool.query(`SELECT * FROM roles WHERE guildId = ?`, [guildId]);
            const roleMap = {};
            for (const r of roles) roleMap[r.kelas] = r.roleId;

            if (kelas === 'A' && roleMap['A']) {
                roleMention = `<@&${roleMap['A']}>`;
            } else if (kelas === 'B' && roleMap['B']) {
                roleMention = `<@&${roleMap['B']}>`;
            } else if (kelas === 'Semua') {
                const mentions = [];
                if (roleMap['A']) mentions.push(`<@&${roleMap['A']}>`);
                if (roleMap['B']) mentions.push(`<@&${roleMap['B']}>`);
                roleMention = mentions.length > 0 ? mentions.join(' ') : '@everyone';
            }

            const kelasLabel = kelas === 'Semua' ? 'Semua Kelas' : `Kelas ${kelas}`;
            await interaction.reply({
                content: `${roleMention} ✅ Deadline **${taskId}** untuk **${kelasLabel}** berhasil ditambahkan.\n📝 **${description}**`,
                ephemeral: false
            });
        } catch (error) {
            console.error('Error handling new task modal:', error);
            await interaction.reply({ content: '❌ Terjadi kesalahan saat menyimpan tugas.', ephemeral: true });
        }
    }
};
