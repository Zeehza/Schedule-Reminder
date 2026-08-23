require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { initDatabase, getDb } = require('./src/database/connection');

// Express server for Dashboard, API, health check + Terms & Privacy pages
const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API Endpoints
app.get('/api/stats', async (req, res) => {
    try {
        const pool = getDb();
        const [channels] = await pool.query('SELECT COUNT(*) as total FROM channels');
        const [tasks] = await pool.query('SELECT COUNT(*) as total FROM tasks');
        
        // Count guilds bot is in directly from Discord Client
        const totalGuilds = client.guilds.cache.size;

        res.json({
            guilds: totalGuilds,
            channels: channels[0].total,
            tasks: tasks[0].total
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

app.get('/api/tasks', async (req, res) => {
    try {
        const pool = getDb();
        const [tasks] = await pool.query('SELECT * FROM tasks ORDER BY deadline ASC LIMIT 50');
        res.json(tasks);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

app.get('/terms',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'terms.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'public', 'privacy.html')));

app.listen(PORT, () => {
    console.log(`Web server & Dashboard listening on port ${PORT}`);
});



// Initialize Discord Client
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

client.commands = new Collection();

// Load Commands
const commandsPath = path.join(__dirname, 'src', 'commands');
if (!fs.existsSync(commandsPath)) {
    fs.mkdirSync(commandsPath, { recursive: true });
}
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

// Load Events
const eventsPath = path.join(__dirname, 'src', 'events');
if (!fs.existsSync(eventsPath)) {
    fs.mkdirSync(eventsPath, { recursive: true });
}
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// Initialize DB and login with retry
(async () => {
    const MAX_RETRIES = 10;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[Attempt ${attempt}/${MAX_RETRIES}] Connecting to database...`);
            await initDatabase();
            console.log('Database connected! Logging in to Discord...');
            await client.login(process.env.DISCORD_TOKEN);
            console.log('Bot is now running!');
            return; // Success, stop retrying
        } catch (error) {
            console.error(`[Attempt ${attempt}/${MAX_RETRIES}] Failed:`, error.message);
            if (attempt < MAX_RETRIES) {
                console.log('Retrying in 10 seconds...');
                await new Promise(resolve => setTimeout(resolve, 10000));
            } else {
                console.error('All retry attempts exhausted. Bot will stay alive for health check but is NOT functional.');
            }
        }
    }
})();
