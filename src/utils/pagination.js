const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');

/**
 * Handles paginated replies for Discord interactions.
 * 
 * @param {Object} interaction - The Discord interaction object.
 * @param {Array} items - The array of items to paginate.
 * @param {number} itemsPerPage - Number of items to display per page.
 * @param {Function} embedGenerator - Function that takes (currentItems, page, totalPages, totalItems) and returns an EmbedBuilder.
 * @param {boolean} [ephemeral=true] - Whether the reply should be ephemeral.
 */
async function paginateReply(interaction, items, itemsPerPage, embedGenerator, ephemeral = true) {
    if (items.length === 0) return;

    const totalPages = Math.ceil(items.length / itemsPerPage);
    let currentPage = 1;

    const generatePageEmbed = (page) => {
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const currentItems = items.slice(start, end);
        return embedGenerator(currentItems, page, totalPages, items.length);
    };

    const generateButtons = (page) => {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('prev_page')
                    .setLabel('⬅️ Sebelumnya')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 1),
                new ButtonBuilder()
                    .setCustomId('next_page')
                    .setLabel('Selanjutnya ➡️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === totalPages)
            );
    };

    const replyOptions = {
        embeds: [generatePageEmbed(currentPage)],
        components: totalPages > 1 ? [generateButtons(currentPage)] : [],
        fetchReply: true
    };
    
    if (ephemeral) {
        replyOptions.flags = MessageFlags.Ephemeral;
    }

    const message = await interaction.reply(replyOptions);

    if (totalPages === 1) return;

    const collector = message.createMessageComponentCollector({ 
        componentType: ComponentType.Button, 
        time: 60000 * 5 // 5 minutes timeout
    });

    collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
            return i.reply({ content: '❌ Kamu tidak bisa menggunakan tombol ini.', flags: MessageFlags.Ephemeral });
        }

        if (i.customId === 'prev_page') {
            currentPage--;
        } else if (i.customId === 'next_page') {
            currentPage++;
        }

        await i.update({
            embeds: [generatePageEmbed(currentPage)],
            components: [generateButtons(currentPage)]
        });
    });

    collector.on('end', () => {
        const disabledRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('prev_page')
                    .setLabel('⬅️ Sebelumnya')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('next_page')
                    .setLabel('Selanjutnya ➡️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true)
            );
        
        interaction.editReply({ components: [disabledRow] }).catch(() => {});
    });
}

module.exports = { paginateReply };
