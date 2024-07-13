const { Client, MessageEmbed } = require('discord.js');
const { logEvent } = require('./logger');
const { startServerStatusMonitoring } = require('./serverStatus');
const { fork } = require('child_process');
const path = require('path');
const config = require('../config.json');
const { createClient } = require('appwrite');

// Initialize Appwrite client
const appwriteClient = createClient({
    endpoint: config.appwrite.endpoint,
    project: config.appwrite.projectId,
    apiKey: config.appwrite.apiKey,
});

// Spawn client.js as a child process
const clientProcess = fork(path.join(__dirname, '..', 'client', 'client.js'));

let gatewayOnline = false; // Flag to track gateway online status

// Handle communication with client.js
clientProcess.on('message', message => {
    if (message === 'ClientOnline') {
        console.log('gateway.js: Successfully connected with client.js');
        gatewayOnline = true;
        sendStatusUpdate('Gateway is online');
    } else if (message.startsWith('ClientError:')) {
        const errorMessage = message.slice('ClientError:'.length).trim();
        console.error('gateway.js: Error from client.js:', errorMessage);
        sendStatusUpdate(`Error from client.js: ${errorMessage}`);
    } else {
        console.log('gateway.js: Received message from client.js:', message);
    }
});

// Handle client.js process exit
clientProcess.on('exit', (code) => {
    console.error('gateway.js: client.js exited with code:', code);
    sendStatusUpdate('client.js exited unexpectedly.');
    // Handle restarting client.js or other actions as needed
});

// Notify that the gateway is online initially
setTimeout(() => {
    if (!gatewayOnline) {
        console.log('gateway.js: Gateway is online');
        sendStatusUpdate('Gateway is online');
    }
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

// Export function for sending messages to client.js if needed
function sendMessageToClient(message) {
    clientProcess.send(message);
}

// Example: Sending a message to client.js
setTimeout(() => {
    sendMessageToClient('Hello from gateway.js');
}, 5000);

// Login with gateway bot token
const gatewayClient = new Client();
gatewayClient.login(config.discord.gatewayToken)
    .then(() => {
        console.log(`gateway.js: Logged in as ${gatewayClient.user.tag}`);
        startServerStatusMonitoring(); // Start server status monitoring after login
    })
    .catch(error => {
        console.error('gateway.js: Failed to login:', error);
        sendStatusUpdate(`Gateway failed to login: ${error.message}`);
    });

// Example function to start server status monitoring
function startServerStatusMonitoring() {
    setInterval(() => {
        const statusMessage = `Server status update: ${new Date().toLocaleTimeString()}`;
        sendStatusUpdate(statusMessage);
    }, 60000); // Update status every 60 seconds
}
