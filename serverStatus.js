async function updateServerStatus(client, config) {
    try {
        // Query system performance
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
            sendAlertToChannel(client, config.discord.alertChannelId, alertMessage);
        }

        logEvent('SystemStatusUpdate', {
            cpuLoad: cpu.currentLoad,
            memoryUsage: mem.used / mem.total,
            diskUsage: disk[0].use
        });

    } catch (error) {
        console.error('Failed to update server status:', error);
        sendErrorToChannel(client, config.guildId, 'System Administrator', `Failed to update server status: ${error.message}\nError Type: ${error.type}\nError Code: ${error.code}`);
        logEvent('ServerStatusUpdateError', { error: error.message });
    }
}

async function updateServerStatus(client, config) {
    // Function implementation
}

function startServerStatusMonitoring(client, config) {
    // Function implementation
}

module.exports = { updateServerStatus, startServerStatusMonitoring };
