function logEvent(moduleName, eventName, eventData) {
    console.log(`[${new Date().toLocaleString()}] [${moduleName}] Event: ${eventName}`, eventData);
}

function sendStatusUpdate(statusMessage = 'Status update') {
    const channelId = config.discord.statusChannelId; // Replace with your actual status channel ID
    const channel = client.channels.cache.get(channelId); // Ensure `client` is defined in the scope or passed as a parameter

    if (channel) {
        channel.send(statusMessage)
            .then(() => console.log(`[${new Date().toLocaleString()}] Status update sent to channel ${channelId}`))
            .catch(error => console.error('Failed to send status update:', error));
    } else {
        console.error(`[${new Date().toLocaleString()}] Channel ${channelId} not found.`);
    }
}

module.exports = { logEvent, sendStatusUpdate };
