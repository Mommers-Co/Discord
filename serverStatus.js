const si = require('systeminformation');
const { Client } = require('discord.js');
const config = require('./config.json'); // Assuming config is a JSON file with relevant settings
const { logEvent } = require('./logger');
const { sendAlertToChannel } = require('./client'); // Import the function to send alerts

const client = new Client();

client.login(config.discord.token)
    .then(() => {
        console.log(`Logged in as ${client.user.tag}`);
        logEvent('BotLogin', { message: `Bot logged in as ${client.user.tag}` });

        // Start server status monitoring after bot is logged in
        startServerStatusMonitoring();
    })
    .catch(error => {
        console.error('Failed to login:', error);
        logEvent('LoginError', { error: error.message });
    });

// Function to update server status and send alerts
async function updateServerStatus() {
    try {
        const cpu = await si.currentLoad();
        const mem = await si.mem();
        const disk = await si.fsSize();

        const alertThresholds = config.server.alertThresholds;
        let alertMessage = '';

        if (cpu.currentLoad > alertThresholds.cpu) {
            alertMessage += `⚠️ High CPU usage: ${cpu.currentLoad.toFixed(2)}%\n`;
        }
        if (mem.used / mem.total > alertThresholds.memory) {
            alertMessage += `⚠️ High memory usage: ${(mem.used / mem.total * 100).toFixed(2)}%\n`;
        }
        if (disk[0].use > alertThresholds.disk) {
            alertMessage += `⚠️ High disk usage: ${disk[0].use}%\n`;
        }

        if (alertMessage) {
            sendAlertToChannel(alertMessage);
        }

        logEvent('SystemStatusUpdate', {
            cpuLoad: cpu.currentLoad,
            memoryUsage: mem.used / mem.total,
            diskUsage: disk[0].use
        });

    } catch (error) {
        console.error('Failed to update server status:', error);
        logEvent('ServerStatusUpdateError', { error: error.message });
    }
}

// Function to start server status monitoring at regular intervals
function startServerStatusMonitoring() {
    updateServerStatus(); // Initial update

    setInterval(() => {
        updateServerStatus();
    }, config.server.monitorInterval * 1000); // Interval in seconds (configured in config.json)
}

module.exports = { client, startServerStatusMonitoring };
