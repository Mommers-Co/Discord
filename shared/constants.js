const serverConfig = {
    monitorInterval: 60, // Interval in seconds for monitoring server status
    alertThresholds: {
        cpu: 80, // CPU usage threshold in percentage
        memory: 80, // Memory usage threshold in percentage
        disk: 80 // Disk usage threshold in percentage
    }
};

module.exports = { serverConfig };
