const si = require('systeminformation');
const { EmbedBuilder } = require('discord.js');
const { logEvent } = require('./logger');
const { serverConfig } = require('./constants');
const config = require('../config.json');

const alertPersistTime = 5 * 60 * 1000; // 5 minutes
const ALERT_COOLDOWN_INTERVAL = 60 * 1000; // 1 minute

// Track previous high usage occurrences
const highUsageStartTimes = {
    cpu: null,
    memory: null,
    disk: null
};

// Function to start server status alerts
function startServerStatusAlerts(client) {
    // Call updateServerStatus to check status immediately
    updateServerStatus(client);
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

// Function to update server status metrics
async function updateServerStatus(client) {
    try {
        // Retrieve system information
        const cpu = await si.currentLoad();
        const mem = await si.mem();
        const disk = await si.fsSize();

        const alertThresholds = serverConfig.alertThresholds;
        let alertMessage = '';

        // Check CPU usage
        if (cpu.currentLoad > alertThresholds.cpu) {
            if (!highUsageStartTimes.cpu) {
                highUsageStartTimes.cpu = Date.now();
            } else if (Date.now() - highUsageStartTimes.cpu >= alertPersistTime) {
                alertMessage += `⚠️ High CPU usage: ${cpu.currentLoad.toFixed(2)}%\n`;
                alertMessage += `In use: ${cpu.currentLoad.toFixed(2)}% - Available: ${(100 - cpu.currentLoad).toFixed(2)}%\n`;
                highUsageStartTimes.cpu = Date.now(); // Reset start time after alert
            }
        } else {
            highUsageStartTimes.cpu = null;
        }

        // Check memory usage
        if ((mem.used / mem.total) * 100 > alertThresholds.memory) {
            if (!highUsageStartTimes.memory) {
                highUsageStartTimes.memory = Date.now();
            } else if (Date.now() - highUsageStartTimes.memory >= alertPersistTime) {
                alertMessage += `⚠️ High memory usage: ${(mem.used / mem.total * 100).toFixed(2)}%\n`;
                alertMessage += `In use: ${(mem.used / mem.total * 100).toFixed(2)}% - Available: ${((1 - (mem.used / mem.total)) * 100).toFixed(2)}%\n`;
                highUsageStartTimes.memory = Date.now(); // Reset start time after alert
            }
        } else {
            highUsageStartTimes.memory = null;
        }

        // Check disk usage
        if (disk.length > 0 && disk[0].use > alertThresholds.disk) {
            if (!highUsageStartTimes.disk) {
                highUsageStartTimes.disk = Date.now();
            } else if (Date.now() - highUsageStartTimes.disk >= alertPersistTime) {
                alertMessage += `⚠️ High disk usage: ${disk[0].use}%\n`;
                alertMessage += `In use: ${disk[0].use}% - Available: ${(100 - disk[0].use).toFixed(2)}%\n`;
                highUsageStartTimes.disk = Date.now(); // Reset start time after alert
            }
        } else {
            highUsageStartTimes.disk = null;
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
