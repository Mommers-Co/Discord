const serverConfig = {
    monitorInterval: 60, // Interval in seconds
    alertThresholds: {
        cpu: 80, // CPU threshold (%)
        memory: 80, // memory threshold (%)
        disk: 80 // disk usage threshold (%)
    }
};

module.exports = { serverConfig };
