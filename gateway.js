const { Client, MessageEmbed, Intents } = require('discord.js');
const { logEvent } = require('./logger'); // Import logging system
const config = require('./config.json');
const { startServerStatusMonitoring } = require('./serverStatus'); // Import startServerStatusMonitoring from serverStatus.js
const { fork } = require('child_process');

// Spawn client.js as a child process
const clientProcess = fork('./client.js');

clientProcess.on('message', message => {
    if (message === 'ClientOnline') {
        console.log('gateway.js: Successfully connected with client.js');
        console.log('gateway.js: Gateway is online');
        // Notify that the gateway is online (optional)
        sendStatusUpdate('Gateway is online');
    }
});

clientProcess.on('exit', (code) => {
    console.error('gateway.js: client.js exited with code:', code);
    // Handle restarting client.js or other actions as needed
});

// Handle communication with client.js
// Example: Sending a message to client.js
setTimeout(() => {
    clientProcess.send('Hello from gateway.js');
}, 5000);

// Function to send status update as an embed message to a specific Discord channel
function sendStatusUpdate(statusMessage = 'Gateway status update') {
    const channelId = config.discord.statusChannelId; // Replace with your actual status channel ID
    const channel = client.channels.cache.get(channelId);

    if (channel) {
        const embed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Gateway Status Update')
            .setDescription(statusMessage)
            .setTimestamp();

        channel.send({ embeds: [embed] })
            .then(() => console.log(`Status update sent to channel ${channelId}`))
            .catch(error => console.error('Failed to send status update:', error));
    } else {
        console.error(`Channel ${channelId} not found.`);
    }
}

// Example: Listen for messages from client.js
process.on('message', message => {
    console.log('gateway.js: Received message from client.js:', message);
});
