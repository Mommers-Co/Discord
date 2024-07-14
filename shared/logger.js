const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, MessageEmbed } = require('discord.js');
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

let gatewayClient;

function initDiscordClient() {
    if (!gatewayClient) {
        gatewayClient = new Client({
            intents: [
                GatewayIntentBits.GUILDS,
                GatewayIntentBits.GUILD_MEMBERS,
                GatewayIntentBits.GUILD_MESSAGES,
                GatewayIntentBits.MESSAGE_CONTENT
            ]
        });

        gatewayClient.login(config.discord.gatewayToken)
            .then(() => {
                const loginMessage = `Gateway Client logged in as ${gatewayClient.user.tag}`;
                console.log(`[${new Date().toLocaleString()}] ${loginMessage}`);
                logEvent('gateway', 'Login', loginMessage);
            })
            .catch(error => {
                const errorMessage = `Failed to login to Discord: ${error.message}`;
                console.error(`[${new Date().toLocaleString()}] ${errorMessage}`);
                logEvent('gateway', 'LoginError', errorMessage);
            });
    }
}

function logEvent(moduleName, eventName, eventData) {
    ensureLogFile(moduleName);
    const logEntry = `[${new Date().toLocaleString()}] [${moduleName}] Event: ${eventName} ${JSON.stringify(eventData)}\n`;
    console.log(logEntry);
    appendLogToFile(moduleName, logEntry);
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
    initDiscordClient();
    const logChannelId = config.discord.logChannelId;
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
                const errorMessage = `Error truncating log file (${moduleName}) after compression: ${err}`;
                console.error(`[${new Date().toLocaleString()}] ${errorMessage}`);
                logEvent('gateway', 'CompressionError', errorMessage);
            }
        });
    } else {
        const errorMessage = `Log file (${moduleName}.log) not found for compression.`;
        console.error(`[${new Date().toLocaleString()}] ${errorMessage}`);
        logEvent('gateway', 'CompressionError', errorMessage);
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
        const errorMessage = `Log file (${moduleName}.log) not found for crash export.`;
        console.error(`[${new Date().toLocaleString()}] ${errorMessage}`);
        logEvent('gateway', 'CrashExportError', errorMessage);
    }
    fs.writeFileSync(crashLogFilePath, logContent);
    logEvent(moduleName, 'Crash', `Crash log exported to ${crashLogFilePath}`);
    sendLogToDiscord(moduleName, `Crash log exported to ${crashLogFilePath}`);
}

function sendStatusUpdate(client, statusMessage = 'Status update') {
    initDiscordClient();
    const channelId = config.discord.statusChannelId;
    if (client) {
        const channel = client.channels.cache.get(channelId);
        if (channel) {
            const embed = new MessageEmbed()
                .setColor('#0099ff')
                .setTitle('Server Status Update')
                .setDescription(statusMessage)
                .setTimestamp();
            channel.send({ embeds: [embed] })
                .then(() => {
                    const successMessage = `Status update sent to channel ${channelId}`;
                    console.log(`[${new Date().toLocaleString()}] ${successMessage}`);
                    logEvent('gateway', 'StatusUpdate', successMessage);
                })
                .catch(error => {
                    const errorMessage = `Failed to send status update: ${error}`;
                    console.error(`[${new Date().toLocaleString()}] ${errorMessage}`);
                    logEvent('gateway', 'StatusUpdateError', errorMessage);
                });
        } else {
            const errorMessage = `Channel ${channelId} not found.`;
            console.error(`[${new Date().toLocaleString()}] ${errorMessage}`);
            logEvent('gateway', 'StatusUpdateError', errorMessage);
        }
    } else {
        const errorMessage = 'Discord client not initialized.';
        console.error(`[${new Date().toLocaleString()}] ${errorMessage}`);
        logEvent('gateway', 'StatusUpdateError', errorMessage);
    }
}

ensureLogFile('gateway');
exportLogsOnCrash('gateway');

module.exports = { logEvent, sendStatusUpdate, compressLogFile };
