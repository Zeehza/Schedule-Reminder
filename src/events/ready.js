const { Events, REST, Routes } = require('discord.js');
const { startCronJob } = require('../services/cron');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        // Register slash commands globally or per-guild
        // For testing, registering globally can take up to an hour. 
        // It's recommended to register per-guild if you need instant updates during dev.
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        
        try {
            console.log('Started refreshing application (/) commands.');
            
            const commands = client.commands.map(cmd => cmd.data.toJSON());
            
            // Using global registration. Change to Routes.applicationGuildCommands if needed for dev
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands },
            );

            console.log('Successfully reloaded application (/) commands.');
        } catch (error) {
            console.error(error);
        }

        // Start the background cron job
        startCronJob(client);
    },
};
