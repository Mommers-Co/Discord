const fs = require('fs');
const path = require('path');
const { Client, MessageEmbed } = require('discord.js');
const config = require('../config.json');
const zlib = require('zlib');

const logDirectory = path.join(__dirname, '..', 'logs'); // Directory for log files

// Ensure log directory exists, create if it doesn't
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory);
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
    const logEntry = `[${new Date().toLocaleString()}] [${moduleName}] Event: ${eventName} ${JSON.stringify(eventData)}\n`;
    console.log(logEntry);
    appendLogToFile(moduleName, logEntry); // Append log to file
}

// Append log entry to a log file for the specific module
function appendLogToFile(moduleName, logEntry) {
    const moduleLogDirectory = path.join(logDirectory, moduleName);

    // Create module-specific log directory if it doesn't exist
    if (!fs.existsSync(moduleLogDirectory)) {
        fs.mkdirSync(moduleLogDirectory);
    }

    const logFilePath = path.join(moduleLogDirectory, `${moduleName}.log`);

    fs.appendFile(logFilePath, logEntry, (err) => {
        if (err) {
            console.error(`[${new Date().toLocaleString()}] Error writing to log file (${moduleName}): ${err}`);
        }
    });
}

// Function to compress log file using zlib
function compressLogFile(moduleName) {
    const moduleLogDirectory = path.join(logDirectory, moduleName);
    const logFilePath = path.join(moduleLogDirectory, `${moduleName}.log`);
    const compressedFilePath = path.join(moduleLogDirectory, `${moduleName}.log.gz`);

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
}

// Function to export logs periodically and compress log file
function exportLogsPeriodically(moduleName) {
    setInterval(() => {
        compressLogFile(moduleName); // Compress log file
    }, 60000); // Compress log file every 60 seconds

    setInterval(() => {
        const logFilePath = path.join(logDirectory, moduleName, `${moduleName}.log`);
        const exportFilePath = path.join(logDirectory, 'exports', `${moduleName}-export-${new Date().toISOString().replace(/:/g, '-')}.log`);

        fs.copyFile(logFilePath, exportFilePath, (err) => {
            if (err) {
                console.error(`[${new Date().toLocaleString()}] Error exporting log file (${moduleName}): ${err}`);
            } else {
                console.log(`[${new Date().toLocaleString()}] Log file exported (${moduleName}) to ${exportFilePath}`);
            }
        });
    }, 1000); // Export log file every second
}

// Function to export logs on crash/error and compress log file
function exportLogsOnCrash(moduleName) {
    process.on('uncaughtException', (err) => {
        const crashLogDirectory = path.join(logDirectory, 'crash_logs');
        if (!fs.existsSync(crashLogDirectory)) {
            fs.mkdirSync(crashLogDirectory);
        }
        const crashLogFilePath = path.join(crashLogDirectory, `${moduleName}_crash.log`);
        const logContent = fs.readFileSync(path.join(logDirectory, moduleName, `${moduleName}.log`));
        
        fs.writeFileSync(crashLogFilePath, logContent);
    });

    process.on('unhandledRejection', (reason, promise) => {
        const crashLogDirectory = path.join(logDirectory, 'crash_logs');
        if (!fs.existsSync(crashLogDirectory)) {
            fs.mkdirSync(crashLogDirectory);
        }
        const crashLogFilePath = path.join(crashLogDirectory, `${moduleName}_crash.log`);
        const logContent = fs.readFileSync(path.join(logDirectory, moduleName, `${moduleName}.log`));
        
        fs.writeFileSync(crashLogFilePath, logContent);
    });
}

// Function to send status update to Discord channel
function sendStatusUpdate(statusMessage = 'Status update') {
    initDiscordClient();

    const channelId = config.discord.statusChannelId;

    if (gatewayClient) {
        const channel = gatewayClient.channels.cache.get(channelId);

        if (channel) {
            const embed = new MessageEmbed()
                .setColor('#0099ff')
                .setTitle('Gateway Status Update')
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

// Start exporting logs and compressing log file for the gateway module
exportLogsPeriodically('gateway');
exportLogsOnCrash('gateway');

module.exports = { logEvent, sendStatusUpdate };

