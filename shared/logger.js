const fs = require('fs');
const path = require('path');
const { MessageEmbed } = require('discord.js');
const config = require('../config.json');
const zlib = require('zlib');

const logDirectory = path.join(__dirname, '..', 'logs', 'logger');
const exportDirectory = path.join(logDirectory, 'exports');

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

function logEvent(eventName, eventCategory, eventData) {
    const logEntry = `[${new Date().toLocaleString()}] Event: ${eventName} (${eventCategory}) ${JSON.stringify(eventData)}\n`;
    console.log(logEntry);
    appendLogToFile('general', logEntry); // Default log file name
    if (eventName.startsWith('ClientError')) {
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
    const gatewayClient = require('../gateway/gateway').client || require('../client/client').client;
    if (gatewayClient) {
        const logChannel = gatewayClient.channels.cache.get(channelId);
        if (logChannel) {
            logChannel.send(`\`\`\`${logEntry}\`\`\``)
                .then(() => {
                    console.log(`[${new Date().toLocaleString()}] Log entry sent to channel ${channelId}`);
                })
                .catch(error => {
                    console.error(`[${new Date().toLocaleString()}] Failed to send log entry to channel ${channelId}: ${error}`);
                    logEvent('DiscordError', 'Failed to send log entry', `to channel ${channelId}: ${error}`);
                });
        } else {
            console.error(`[${new Date().toLocaleString()}] Log channel ${channelId} not found.`);
            logEvent('DiscordError', 'Log channel not found', channelId);
        }
    } else {
        console.error(`[${new Date().toLocaleString()}] Discord client not initialized.`);
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

function sendStatusUpdate(client, statusMessage = 'Status update') {
    const channelId = config.discord.statusChannelId;
    const gatewayClient = require('../gateway/gateway').client || require('../client/client').client;
    if (gatewayClient) {
        const channel = gatewayClient.channels.cache.get(channelId);
        if (channel) {
            const embed = new MessageEmbed()
                .setColor('#0099ff')
                .setTitle('Server Status Update')
                .setDescription(statusMessage)
                .setTimestamp();
            channel.send({ embeds: [embed] })
                .then(() => {
                    console.log(`[${new Date().toLocaleString()}] Status update sent to channel ${channelId}`);
                })
                .catch(error => {
                    console.error(`[${new Date().toLocaleString()}] Failed to send status update: ${error}`);
                    logEvent('DiscordError', 'Failed to send status update', error);
                });
        } else {
            console.error(`[${new Date().toLocaleString()}] Channel ${channelId} not found.`);
            logEvent('DiscordError', 'Channel not found', channelId);
        }
    } else {
        console.error(`[${new Date().toLocaleString()}] Discord client not initialized.`);
        logEvent('DiscordError', 'Discord client not initialized', null);
    }
}

function handleClientError(moduleName, errorCategory, errorMessage, error) {
    const formattedError = `[${new Date().toLocaleString()}] ${moduleName} Error (${errorCategory}): ${errorMessage}\n${error ? error.stack || error.message || error.toString() : 'Unknown Error'}`;
    console.error(formattedError);
    logEvent(`${moduleName}Error`, `${errorCategory}`, formattedError);
}

module.exports = { logEvent, sendStatusUpdate, compressLogFile, exportLogsOnCrash, handleClientError };
