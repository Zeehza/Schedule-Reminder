const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

async function initDatabase() {
    // First, connect without a specific database to ensure it exists
    const tempConnection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
    });

    const dbName = process.env.DB_NAME || 'schedule_reminder_db';
    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await tempConnection.end();

    // Now create the connection pool
    pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: dbName,
        timezone: '+00:00',
        dateStrings: true,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    // Initialize tables
    await pool.query(`
        CREATE TABLE IF NOT EXISTS channels (
            guildId VARCHAR(255),
            channelId VARCHAR(255) NOT NULL,
            kelas ENUM('A', 'B', 'Semua') DEFAULT 'Semua',
            PRIMARY KEY (guildId, kelas)
        )
    `);

    // Migrate existing channels table if needed (drop primary key and add new one)
    try {
        await pool.query(`ALTER TABLE channels ADD COLUMN kelas ENUM('A', 'B', 'Semua') DEFAULT 'Semua'`);
        await pool.query(`ALTER TABLE channels DROP PRIMARY KEY, ADD PRIMARY KEY(guildId, kelas)`);
    } catch (err) {
        // Ignored if already migrated or column exists
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS pinned_messages (
            taskId VARCHAR(255) NOT NULL,
            channelId VARCHAR(255) NOT NULL,
            messageId VARCHAR(255) NOT NULL,
            PRIMARY KEY (taskId, channelId, messageId)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS tasks (
            id VARCHAR(255) PRIMARY KEY,
            guildId VARCHAR(255) NOT NULL,
            description TEXT,
            deadline DATETIME NOT NULL,
            link TEXT,
            repeat_status ENUM('Once', 'Weekly') DEFAULT 'Once',
            kelas ENUM('A', 'B', 'Semua') DEFAULT 'Semua'
        )
    `);

    // Add kelas column if it doesn't exist (for existing databases)
    try {
        await pool.query(`ALTER TABLE tasks ADD COLUMN kelas ENUM('A', 'B', 'Semua') DEFAULT 'Semua'`);
    } catch (err) {
        // Column already exists, ignore
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS roles (
            guildId VARCHAR(255) NOT NULL,
            kelas ENUM('A', 'B') NOT NULL,
            roleId VARCHAR(255) NOT NULL,
            PRIMARY KEY (guildId, kelas)
        )
    `);

    console.log('Database initialized successfully.');
}

function getDb() {
    if (!pool) {
        throw new Error('Database not initialized. Call initDatabase first.');
    }
    return pool;
}

module.exports = { initDatabase, getDb };
