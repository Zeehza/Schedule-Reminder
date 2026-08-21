const { Events, MessageFlags } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing ${interaction.commandName}`);
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
                }
            }
        } else if (interaction.isStringSelectMenu()) {
            // Handle kelas select menus for /new and /edit
            try {
                if (interaction.customId === 'newTaskKelasSelect') {
                    const newCommand = client.commands.get('new');
                    if (newCommand && newCommand.handleKelasSelect) {
                        await newCommand.handleKelasSelect(interaction);
                    }
                } else if (interaction.customId.startsWith('editTaskKelasSelect_')) {
                    const editCommand = client.commands.get('edit');
                    if (editCommand && editCommand.handleKelasSelect) {
                        await editCommand.handleKelasSelect(interaction);
                    }
                }
            } catch (error) {
                console.error('Error handling select menu:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ Terjadi kesalahan.', flags: MessageFlags.Ephemeral });
                }
            }
        } else if (interaction.isModalSubmit()) {
            // Modals from /new and /edit will be handled in those respective command files 
            // by calling a specific handler function, or we can route them here.
            // Let's route them based on customId prefix.
            
            try {
                if (interaction.customId.startsWith('newTaskModal_')) {
                    const newCommand = client.commands.get('new');
                    if (newCommand && newCommand.handleModal) {
                        await newCommand.handleModal(interaction);
                    }
                } else if (interaction.customId.startsWith('editTaskModal_')) {
                    const editCommand = client.commands.get('edit');
                    if (editCommand && editCommand.handleModal) {
                        await editCommand.handleModal(interaction);
                    }
                }
            } catch (error) {
                console.error('Error handling modal:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ Terjadi kesalahan.', flags: MessageFlags.Ephemeral });
                }
            }
        }
    },
};
