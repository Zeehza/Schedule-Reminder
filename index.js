require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { initDatabase } = require('./src/database/connection');

// HTTP server for Coolify health check + Terms & Privacy pages
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    if (req.url === '/terms') {
        const terms = fs.readFileSync(path.join(__dirname, 'TERMS.md'), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderPage('Terms of Service', terms));
    } else if (req.url === '/privacy') {
        const privacy = fs.readFileSync(path.join(__dirname, 'PRIVACY.md'), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderPage('Privacy Policy', privacy));
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Schedule Reminder Bot is running!');
    }
}).listen(PORT, () => {
    console.log(`Health check server listening on port ${PORT}`);
});

function renderPage(title, markdown) {
    // Simple markdown to HTML conversion
    const html = markdown
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^\* (.+)$/gm, '<li>$1</li>')
        .replace(/^(\d+\.\d+)\. (.+)$/gm, '<li><strong>$1.</strong> $2</li>')
        .replace(/\n\n/g, '<br><br>');
    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Schedule Reminder Bot</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: #1a1a2e; color: #e0e0e0; line-height: 1.8; padding: 2rem; }
        .container { max-width: 800px; margin: 0 auto; background: #16213e; border-radius: 16px; padding: 3rem; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
        h1 { color: #9b59b6; margin-bottom: 0.5rem; font-size: 2rem; }
        h2 { color: #bb86fc; margin-top: 2rem; margin-bottom: 0.5rem; }
        h3 { color: #ce93d8; margin-top: 1.5rem; margin-bottom: 0.5rem; }
        li { margin-left: 1.5rem; margin-bottom: 0.3rem; }
        strong { color: #f0f0f0; }
        a { color: #bb86fc; }
        .footer { text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #333; color: #888; font-size: 0.9rem; }
    </style>
</head>
<body>
    <div class="container">
        ${html}
        <div class="footer">Schedule Reminder Bot &copy; 2026 Zeehza</div>
    </div>
</body>
</html>`;
}

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
