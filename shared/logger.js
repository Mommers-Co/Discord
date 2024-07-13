const fs = require('fs');
const path = require('path');
const { Client, MessageEmbed } = require('discord.js');
const config = require('../config.json');
const zlib = require('zlib');

const logDirectory = path.join(__dirname, '..', 'logs'); // Directory for log files
const exportDirectory = path.join(logDirectory, 'exports'); // Export directory

// Ensure log and export directories exist
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
}

if (!fs.existsSync(exportDirectory)) {
    fs.mkdirSync(exportDirectory, { recursive: true });
}

// Function to ensure log file exists for the module
function ensureLogFile(moduleName) {
    const moduleLogDirectory = path.join(logDirectory, moduleName);

    // Create module-specific log directory if it doesn't exist
    if (!fs.existsSync(moduleLogDirectory)) {
        fs.mkdirSync(moduleLogDirectory, { recursive: true });
    }

    // Create module-specific log file if it doesn't exist
    const logFilePath = path.join(moduleLogDirectory, `${moduleName}.log`);
    if (!fs.existsSync(logFilePath)) {
        fs.writeFileSync(logFilePath, ''); // Create an empty file
    }
}

let gatewayClient; // Declare gatewayClient globally

// Function to initialize the Discord client
function initDiscordClient() {
    if (!gatewayClient) {
        gatewayClient = new Client();
        gatewayClient.login(config.discord.gatewayToken)
            .then(() => console.log(`[${new Date().toLocaleString()}] Gateway Client logged in as ${gatewayClient.user.tag}`))
            .catch(error => console.error(`[${new Date().toLocaleString()}] Failed to login to Discord: ${error.message}`));
    }
}

// Function to log events with a timestamp
function logEvent(moduleName, eventName, eventData) {
    ensureLogFile(moduleName); // Ensure log file exists
    const logEntry = `[${new Date().toLocaleString()}] [${moduleName}] Event: ${eventName} ${JSON.stringify(eventData)}\n`;
    console.log(logEntry);
    appendLogToFile(moduleName, logEntry); // Append log to file
}

// Append log entry to a log file for the specific module
function appendLogToFile(moduleName, logEntry) {
    const logFilePath = path.join(logDirectory, moduleName, `${moduleName}.log`);

    fs.appendFile(logFilePath, logEntry, (err) => {
        if (err) {
            console.error(`[${new Date().toLocaleString()}] Error writing to log file (${moduleName}): ${err}`);
        }
    });
}

// Function to compress log file using zlib
function compressLogFile(moduleName) {
    const logFilePath = path.join(logDirectory, moduleName, `${moduleName}.log`);
    const compressedFilePath = path.join(logDirectory, moduleName, `${moduleName}.log.gz`);

    if (fs.existsSync(logFilePath)) {
        const gzip = zlib.createGzip();
        const input = fs.createReadStream(logFilePath);
        const output = fs.createWriteStream(compressedFilePath);

        input.pipe(gzip).pipe(output);

        // Clear log file after compression
        fs.truncate(logFilePath, 0, (err) => {
            if (err) {
                console.error(`[${new Date().toLocaleString()}] Error truncating log file (${moduleName}) after compression: ${err}`);
            }
        });
    } else {
        console.error(`[${new Date().toLocaleString()}] Log file (${moduleName}.log) not found for compression.`);
    }
}

// Function to export logs on crash/error and compress log file
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
}

// Function to send status update to Discord channel
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
                .then(() => console.log(`[${new Date().toLocaleString()}] Status update sent to channel ${channelId}`))
                .catch(error => console.error(`[${new Date().toLocaleString()}] Failed to send status update: ${error}`));
        } else {
            console.error(`[${new Date().toLocaleString()}] Channel ${channelId} not found.`);
        }
    } else {
        console.error(`[${new Date().toLocaleString()}] Discord client not initialized.`);
    }
}

// Ensure log files exist for each module and start handling crashes
ensureLogFile('gateway'); // Example for the 'gateway' module
exportLogsOnCrash('gateway'); // Example for the 'gateway' module

module.exports = { logEvent, sendStatusUpdate };
