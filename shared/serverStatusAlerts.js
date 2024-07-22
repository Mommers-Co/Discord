const si = require('systeminformation');
const { sendStatusUpdate } = require('./utils');
const { logEvent } = require('./logger');
const { serverConfig } = require('./constants');

// Function to start server status monitoring
function startServerStatusAlerts(client) {
    setInterval(() => {
        const statusMessage = `Server status update: ${new Date().toLocaleTimeString()}`;
        sendStatusUpdate(client, statusMessage);
        updateServerStatus(client);
    }, serverConfig.monitorInterval * 1000); // Update status every `monitorInterval` seconds
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
        }
        if ((mem.used / mem.total) * 100 > alertThresholds.memory) {
            alertMessage += `⚠️ High memory usage: ${(mem.used / mem.total * 100).toFixed(2)}%\n`;
        }
        if (disk.length > 0 && disk[0].use > alertThresholds.disk) {
            alertMessage += `⚠️ High disk usage: ${disk[0].use}%\n`;
        }

        if (alertMessage) {
            sendStatusUpdate(client, alertMessage);
        }

        logEvent('SystemStatusUpdate', {
            cpuLoad: cpu.currentLoad.toFixed(2),
            memoryUsage: ((mem.used / mem.total) * 100).toFixed(2),
            diskUsage: disk.length > 0 ? disk[0].use : 'N/A'
        });

    } catch (error) {
        console.error('Failed to update server status:', error);
        logEvent('ServerStatusUpdateError', { error: error.message });
    }
}

module.exports = { startServerStatusAlerts };
