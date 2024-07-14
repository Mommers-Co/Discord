const fs = require('fs');
const path = require('path');
const { MessageEmbed } = require('discord.js');
const config = require('../config.json');
const zlib = require('zlib');

const logDirectory = path.join(__dirname, '..', 'logs');
const exportDirectory = path.join(logDirectory, 'exports');

if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
}

if (!fs.existsSync(exportDirectory)) {
    fs.mkdirSync(exportDirectory, { recursive: true });
}

function ensureLogFile(moduleName) {
    const moduleLogDirectory = path.join(logDirectory, moduleName);
    if (!fs.existsSync(moduleLogDirectory)) {
        fs.mkdirSync(moduleLogDirectory, { recursive: true });
    }
    const logFilePath = path.join(moduleLogDirectory, `${moduleName}.log`);
    if (!fs.existsSync(logFilePath)) {
        fs.writeFileSync(logFilePath, '');
    }
}

function logEvent(moduleName, eventName, eventData) {
    ensureLogFile(moduleName);
    const logEntry = `[${new Date().toLocaleString()}] [${moduleName}] Event: ${eventName} ${JSON.stringify(eventData)}\n`;
    console.log(logEntry);
    appendLogToFile(moduleName, logEntry);
    // Optionally send to Discord channel
    sendLogToDiscord(moduleName, logEntry);
}

function appendLogToFile(moduleName, logEntry) {
    const logFilePath = path.join(logDirectory, moduleName, `${moduleName}.log`);
    fs.appendFile(logFilePath, logEntry, (err) => {
        if (err) {
            console.error(`[${new Date().toLocaleString()}] Error writing to log file (${moduleName}): ${err}`);
        }
    });
}

function sendLogToDiscord(moduleName, logEntry) {
    const logChannelId = config.discord.logChannelId;
    const gatewayClient = require('./gateway').client; // Import Discord client from gateway.js or client.js
    
    if (gatewayClient) {
        const logChannel = gatewayClient.channels.cache.get(logChannelId);
        if (logChannel) {
            logChannel.send(`\`\`\`${logEntry}\`\`\``)
                .then(() => {
                    console.log(`[${new Date().toLocaleString()}] Log entry sent to channel ${logChannelId}`);
                })
                .catch(error => {
                    console.error(`[${new Date().toLocaleString()}] Failed to send log entry: ${error}`);
                });
        } else {
            console.error(`[${new Date().toLocaleString()}] Log channel ${logChannelId} not found.`);
        }
    } else {
        console.error(`[${new Date().toLocaleString()}] Discord client not initialized.`);
    }
}

function compressLogFile(moduleName) {
    const logFilePath = path.join(logDirectory, moduleName, `${moduleName}.log`);
    const compressedFilePath = path.join(logDirectory, moduleName, `${moduleName}.log.gz`);
    if (fs.existsSync(logFilePath)) {
        const gzip = zlib.createGzip();
        const input = fs.createReadStream(logFilePath);
        const output = fs.createWriteStream(compressedFilePath);
        input.pipe(gzip).pipe(output);
        fs.truncate(logFilePath, 0, (err) => {
            if (err) {
                console.error(`[${new Date().toLocaleString()}] Error truncating log file (${moduleName}) after compression: ${err}`);
            }
        });
    } else {
        console.error(`[${new Date().toLocaleString()}] Log file (${moduleName}.log) not found for compression.`);
    }
}

function exportLogsOnCrash(moduleName) {
    process.on('uncaughtException', (err) => {
        handleCrash(moduleName, err);
    });

    process.on('unhandledRejection', (reason, promise) => {
        handleCrash(moduleName, reason);
    });
}

function handleCrash(moduleName, error) {
    const crashLogDirectory = path.join(logDirectory, 'crash_logs');
    if (!fs.existsSync(crashLogDirectory)) {
        fs.mkdirSync(crashLogDirectory, { recursive: true });
    }
    const crashLogFilePath = path.join(crashLogDirectory, `${moduleName}_crash.log`);
    const logFilePath = path.join(logDirectory, moduleName, `${moduleName}.log`);
    let logContent = '';
    if (fs.existsSync(logFilePath)) {
        logContent = fs.readFileSync(logFilePath);
    } else {
        console.error(`[${new Date().toLocaleString()}] Log file (${moduleName}.log) not found for crash export.`);
    }
    fs.writeFileSync(crashLogFilePath, logContent);
    logEvent(moduleName, 'Crash', `Crash log exported to ${crashLogFilePath}`);
    // Optionally send crash log to Discord
    sendLogToDiscord(moduleName, `Crash log exported to ${crashLogFilePath}`);
}

function sendStatusUpdate(client, statusMessage = 'Status update') {
    const channelId = config.discord.statusChannelId;
    const gatewayClient = require('./gateway').client; // Import Discord client from gateway.js or client.js
    
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
                });
        } else {
            console.error(`[${new Date().toLocaleString()}] Channel ${channelId} not found.`);
        }
    } else {
        console.error(`[${new Date().toLocaleString()}] Discord client not initialized.`);
    }
}

// Export functions for use in other modules
module.exports = { logEvent, sendStatusUpdate, compressLogFile, exportLogsOnCrash };
