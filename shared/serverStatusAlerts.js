const si = require('systeminformation');
const { EmbedBuilder } = require('discord.js');
const { logEvent } = require('./logger');
const { serverConfig } = require('./constants');
const config = require('../config.json');

const alertCooldowns = new Map();
const ALERT_COOLDOWN_INTERVAL = 60 * 1000; // 1 minute

// Function to start server status monitoring
function startServerStatusAlerts(client) {
    setInterval(() => {
        const statusMessage = `Server status update: ${new Date().toLocaleTimeString()}`;
        sendStatusUpdate(client, statusMessage);
        updateServerStatus(client);
    }, serverConfig.monitorInterval * 1000); // Update status every `monitorInterval` seconds
}

// Function to send a system alert
async function sendSystemAlert(client, channelId, alertMessage) {
    try {
        const alertChannel = await client.channels.fetch(channelId);

        if (!alertChannel) {
            throw new Error(`Alert channel with ID ${channelId} not found.`);
        }

        // System Administrator Role ID from config or direct use
        const adminRoleId = '972359999714111528';

        // Mention the system administrator role in the alert
        const alertEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('System Alert')
            .setDescription(`${alertMessage}\n\n<@&${adminRoleId}>`)
            .setFooter({ text: 'Immediate attention required.', iconURL: 'https://i.imgur.com/QmJkPOZ.png' })
            .setTimestamp();

        // Send the alert as a new message without editing the previous one
        await alertChannel.send({ embeds: [alertEmbed] });

        logEvent('SystemAlertSent', 'System Alert', alertMessage);
    } catch (error) {
        console.error('Failed to send system alert:', error);
        logEvent('SystemAlertError', 'Error', error.message);
    }
}

// Function to send the status update to the Discord channel
async function sendStatusUpdate(client, statusMessage = 'Status update') {
    const channelId = config.discord.channels.systemAlertsId;

    if (client) {
        const channel = client.channels.cache.get(channelId);

        if (channel) {
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('System Status Update')
                .setDescription(`${statusMessage}\n\n<@&972359999714111528>`) // Mentioning the system administrator role
                .setTimestamp();

            try {
                // Send a new message each time without editing any existing messages
                await channel.send({ embeds: [embed] });
                logEvent('StatusUpdateSent', 'System Status Update', statusMessage);
            } catch (error) {
                console.error(`[${new Date().toLocaleString()}] Failed to send status update: ${error}`);
                logEvent('StatusUpdateError', 'Error', error.message);
            }
        } else {
            console.error(`[${new Date().toLocaleString()}] Channel ${channelId} not found.`);
            logEvent('ChannelNotFound', 'Error', `Channel ${channelId} not found.`);
        }
    } else {
        console.error(`[${new Date().toLocaleString()}] Status client not initialized.`);
        logEvent('ClientNotInitialized', 'Error', 'Status client is not initialized');
    }
}

// Function to update server status metrics
async function updateServerStatus(client) {
    try {
        // Retrieve system information
        const cpu = await si.currentLoad();
        const mem = await si.mem();
        const disk = await si.fsSize();

        const alertThresholds = serverConfig.alertThresholds;
        let alertMessage = '';

        if (cpu.currentLoad > alertThresholds.cpu) {
            alertMessage += `⚠️ High CPU usage: ${cpu.currentLoad.toFixed(2)}%\n`;
            alertMessage += `In use: ${cpu.currentLoad.toFixed(2)}% - Available: ${(100 - cpu.currentLoad).toFixed(2)}%\n`;
        }
        if ((mem.used / mem.total) * 100 > alertThresholds.memory) {
            alertMessage += `⚠️ High memory usage: ${(mem.used / mem.total * 100).toFixed(2)}%\n`;
            alertMessage += `In use: ${(mem.used / mem.total * 100).toFixed(2)}% - Available: ${((1 - (mem.used / mem.total)) * 100).toFixed(2)}%\n`;
        }
        if (disk.length > 0 && disk[0].use > alertThresholds.disk) {
            alertMessage += `⚠️ High disk usage: ${disk[0].use}%\n`;
            alertMessage += `In use: ${disk[0].use}% - Available: ${(100 - disk[0].use).toFixed(2)}%\n`;
        }

        // Send system alert if necessary and not recently sent
        if (alertMessage) {
            const now = Date.now();
            const lastSent = alertCooldowns.get('systemAlert') || 0;

            if (now - lastSent > ALERT_COOLDOWN_INTERVAL) {
                alertCooldowns.set('systemAlert', now);
                await sendSystemAlert(client, config.discord.channels.systemAlertChannelId, alertMessage);
            }
        }

        logEvent('SystemStatusUpdate', {
            cpuLoad: cpu.currentLoad.toFixed(2),
            memoryUsage: ((mem.used / mem.total) * 100).toFixed(2),
            diskUsage: disk.length > 0 ? disk[0].use : 'N/A'
        });

    } catch (error) {
        console.error('Failed to update server status:', error);
        logEvent('ServerStatusUpdateError', 'Error', error.message);
    }
}

module.exports = { startServerStatusAlerts };
