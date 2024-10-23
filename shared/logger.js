const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const config = require('../config.json');
const zlib = require('zlib');
const { client } = require('../client/client');

const logDirectory = path.join(__dirname, '..', 'logs');
const exportDirectory = path.join(logDirectory, 'exports');

// Rate limiting configuration
const RATE_LIMIT_INTERVAL = 60000; // 60 seconds
const DISCORD_MESSAGES_SENT = new Map();

if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
}

if (!fs.existsSync(exportDirectory)) {
    fs.mkdirSync(exportDirectory, { recursive: true });
}

function ensureLogFile(logFileName) {
    const logFilePath = path.join(logDirectory, `${logFileName}.log`);
    if (!fs.existsSync(logFilePath)) {
        fs.writeFileSync(logFilePath, '');
    }
}

function logEvent(eventName, eventCategory = 'General', eventData = '', guildId = null) {
    const logEntry = `[${new Date().toLocaleString()}] Event: ${eventName} (${eventCategory}) ${JSON.stringify(eventData)}\n`;
    console.log(logEntry);
    appendLogToFile('general', logEntry); // Default log file name

    // Only send critical errors to Discord
    if (eventCategory === 'Error' || eventName.startsWith('ClientError')) {
        const channelId = getGuildConfig(guildId).channels.discordConsoleId;
        sendLogToDiscord(logEntry, channelId, guildId);
    } else if (eventCategory === 'Crash' || eventCategory === 'Debug') {
        const channelId = getGuildConfig(guildId).channels.logChannelId;
        sendLogToDiscord(logEntry, channelId, guildId);
    }
}

function appendLogToFile(logFileName, logEntry) {
    ensureLogFile(logFileName);
    const logFilePath = path.join(logDirectory, `${logFileName}.log`);
    fs.appendFile(logFilePath, logEntry, err => {
        if (err) {
            console.error(`[${new Date().toLocaleString()}] Error writing to log file (${logFileName}): ${err}`);
            logEvent('FileError', 'Error writing to log file', `(${logFileName}): ${err}`);
        }
    });
}

// Helper function to get guild-specific configuration
function getGuildConfig(guildId) {
    if (!guildId || guildId === config.discord.MCOGuild.guildId) {
        return config.discord.MCOGuild;
    } else if (guildId === config.discord.MCOLOGGuild.guildId) {
        return config.discord.MCOLOGGuild;
    } else {
        console.error(`Unknown guild ID: ${guildId}`);
        return null;
    }
}

// support multi-guild logging
function sendLogToDiscord(logEntry, channelId, guildId = null) {
    if (!client || !client.isReady()) {
        console.error(`[${new Date().toLocaleString()}] Discord client not initialized.`);
        logEvent('DiscordError', 'Discord client not initialized', null);
        return;
    }

    const currentTimestamp = Date.now();
    const lastSentTimestamp = DISCORD_MESSAGES_SENT.get(channelId) || 0;

    if (currentTimestamp - lastSentTimestamp < RATE_LIMIT_INTERVAL) {
        console.warn(`[${new Date().toLocaleString()}] Rate limit reached for channel ${channelId}. Skipping message.`);
        return;
    }

    DISCORD_MESSAGES_SENT.set(channelId, currentTimestamp);

    // Fetch the appropriate guild and channel based on the provided guildId
    const guildConfig = getGuildConfig(guildId);
    if (!guildConfig) {
        return; // If no valid guild is found, exit.
    }

    const logChannel = client.guilds.cache.get(guildConfig.guildId)?.channels.cache.get(channelId);

    if (logChannel) {
        const embed = new EmbedBuilder()
            .setTitle('Log Entry')
            .setDescription(`\`\`\`${logEntry}\`\`\``)
            .setColor('#0099ff')
            .setTimestamp();

        logChannel.send({ embeds: [embed] })
            .then(() => {
                console.log(`[${new Date().toLocaleString()}] Log entry sent to channel ${channelId}`);
            })
            .catch(error => {
                console.error(`[${new Date().toLocaleString()}] Failed to send log entry to channel ${channelId}: ${error}`);
                logEvent('DiscordError', 'Failed to send log entry', `to channel ${channelId}: ${error}`, guildId);
            });
    } else {
        console.error(`[${new Date().toLocaleString()}] Log channel ${channelId} not found in guild ${guildId}.`);
        logEvent('DiscordError', 'Log channel not found', channelId, guildId);
    }
}

function compressLogFile(logFileName) {
    const logFilePath = path.join(logDirectory, `${logFileName}.log`);
    const compressedFilePath = path.join(exportDirectory, `${logFileName}.log.gz`);
    if (fs.existsSync(logFilePath)) {
        const gzip = zlib.createGzip();
        const input = fs.createReadStream(logFilePath);
        const output = fs.createWriteStream(compressedFilePath);
        input.pipe(gzip).pipe(output);
        output.on('finish', () => {
            console.log(`[${new Date().toLocaleString()}] Compression finished for: ${compressedFilePath}`);
        });
        fs.truncate(logFilePath, 0, err => {
            if (err) {
                console.error(`[${new Date().toLocaleString()}] Error truncating log file (${logFileName}) after compression: ${err}`);
                logEvent('FileError', 'Error truncating log file after compression', `${logFileName}: ${err}`);
            }
        });
    } else {
        console.error(`[${new Date().toLocaleString()}] Log file (${logFileName}.log) not found for compression.`);
        logEvent('FileError', 'Log file not found for compression', `${logFileName}.log`);
    }
}

function exportLogsOnCrash(logFileName) {
    process.on('uncaughtException', err => {
        handleCrash(logFileName, err);
    });

    process.on('unhandledRejection', (reason, promise) => {
        handleCrash(logFileName, reason);
    });
}

function handleCrash(logFileName, error) {
    const crashLogDirectory = path.join(logDirectory, 'crash_logs');
    if (!fs.existsSync(crashLogDirectory)) {
        fs.mkdirSync(crashLogDirectory, { recursive: true });
    }
    const crashLogFilePath = path.join(crashLogDirectory, `${logFileName}_crash.log`);
    const logFilePath = path.join(logDirectory, `${logFileName}.log`);
    let logContent = '';
    if (fs.existsSync(logFilePath)) {
        logContent = fs.readFileSync(logFilePath);
    } else {
        console.error(`[${new Date().toLocaleString()}] Log file (${logFileName}.log) not found for crash export.`);
        logEvent('FileError', 'Log file not found for crash export', `${logFileName}.log`);
    }
    fs.writeFileSync(crashLogFilePath, logContent);
    logEvent('Crash', 'Crash log exported', crashLogFilePath, null);
    const channelId = getGuildConfig(null).channels.logChannelId;
    sendLogToDiscord(`Crash log exported to ${crashLogFilePath}`, channelId);
}

module.exports = { logEvent, compressLogFile, exportLogsOnCrash };
