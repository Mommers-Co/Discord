const serverConfig = {
    monitorInterval: 60, // Interval in seconds
    alertThresholds: {
        cpu: 80, // Example CPU threshold (%)
        memory: 80, // Example memory threshold (%)
        disk: 80 // Example disk usage threshold (%)
    }
};

module.exports = { serverConfig };
