const fs = require('fs');
const path = require('path');
const { MessageEmbed } = require('discord.js');
const config = require('../config.json');
const zlib = require('zlib');
const { client } = require('../gateway/clientInitializer'); // Adjusted import for client

const logDirectory = path.join(__dirname, '..', 'logs', 'logger');
const exportDirectory = path.join(logDirectory, 'exports');

if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
}

if (!fs.existsSync(exportDirectory)) {
    fs.mkdirSync(exportDirectory, { recursive: true });
}

const rateLimit = new Map(); // To store the last sent time for each channel
const RATE_LIMIT_MS = 60000; // 1 minute

function ensureLogFile(logFileName) {
    const logFilePath = path.join(logDirectory, `${logFileName}.log`);
    if (!fs.existsSync(logFilePath)) {
        fs.writeFileSync(logFilePath, '');
    }
}

function logEvent(eventName, eventCategory = 'General', eventData = '') {
    const logEntry = `[${new Date().toLocaleString()}] Event: ${eventName} (${eventCategory}) ${JSON.stringify(eventData)}\n`;
    console.log(logEntry);
    appendLogToFile('general', logEntry); // Default log file name
    if (eventCategory === 'Error' || eventName.startsWith('ClientError')) {
        sendLogToDiscord(logEntry, config.discord.consoleId);
    } else {
        sendLogToDiscord(logEntry, config.discord.logChannelId);
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

function sendLogToDiscord(logEntry, channelId) {
    if (client && client.isReady()) {
        const now = Date.now();
        const lastSent = rateLimit.get(channelId) || 0;

        if (now - lastSent < RATE_LIMIT_MS) {
            // Log is being rate-limited, do not send
            console.log(`[${new Date().toLocaleString()}] Rate limit applied for channel ${channelId}. Skipping log entry.`);
            return;
        }

        client.channels.fetch(channelId)
            .then(channel => {
                if (channel) {
                    channel.send(`\`\`\`${logEntry}\`\`\``)
                        .then(() => {
                            console.log(`[${new Date().toLocaleString()}] Log entry sent to channel ${channelId}`);
                            rateLimit.set(channelId, now); // Update last sent time
                        })
                        .catch(error => {
                            console.error(`[${new Date().toLocaleString()}] Failed to send log entry to channel ${channelId}: ${error}`);
                            logEvent('DiscordError', 'Failed to send log entry', `to channel ${channelId}: ${error}`);
                        });
                } else {
                    console.error(`[${new Date().toLocaleString()}] Log channel ${channelId} not found.`);
                    logEvent('DiscordError', 'Log channel not found', channelId);
                }
            })
            .catch(error => {
                console.error(`[${new Date().toLocaleString()}] Error fetching channel ${channelId}: ${error}`);
                logEvent('DiscordError', 'Error fetching channel', channelId);
            });
    } else {
        console.error(`[${new Date().toLocaleString()}] Discord client not initialized or not ready.`);
        logEvent('DiscordError', 'Discord client not initialized', null);
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
    logEvent('Crash', 'Crash log exported', crashLogFilePath);
    sendLogToDiscord(`Crash log exported to ${crashLogFilePath}`, config.discord.logChannelId);
}

module.exports = { logEvent, compressLogFile, exportLogsOnCrash };
