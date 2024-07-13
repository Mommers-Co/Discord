const { Client, MessageEmbed } = require('discord.js');
const { logEvent, } = require('../shared/logger'); // Import logEvent and sendStatusUpdate from logger
const { fork } = require('child_process');
const path = require('path');

// Import createClient from appwrite module
const { createClient } = require('appwrite');

const config = require('../config.json'); // Load config.json from the directory

let appwriteClient;
try {
    appwriteClient = createClient({
        endpoint: config.appwrite.endpoint,
        project: config.appwrite.projectId,
        apiKey: config.appwrite.apiKey,
    });
    logEvent('Gateway', 'AppwriteClient', 'Appwrite client initialized successfully');
} catch (error) {
    logEvent('Gateway', 'AppwriteClientError', `Failed to initialize Appwrite client: ${error.message}`);
    console.error('Failed to initialize Appwrite client:', error);
    process.exit(1); // Exit the process or handle the error accordingly
}


// Spawn client.js as a child process
const clientProcess = fork(path.join(__dirname, '..', 'client', 'client.js'));

let gatewayClient; // Declare gatewayClient globally

// Handle communication with client.js
clientProcess.on('message', message => {
    if (message === 'ClientOnline') {
        logEvent('Gateway', 'ClientOnline', 'Successfully connected with client.js');
        sendStatusUpdate('Gateway is online');
    } else if (message.startsWith('ClientError:')) {
        const errorMessage = message.slice('ClientError:'.length).trim();
        logEvent('Gateway', 'ClientError', errorMessage);
        console.error('Error from client.js:', errorMessage);
        sendStatusUpdate(`Error from client.js: ${errorMessage}`);
    } else {
        logEvent('Gateway', 'MessageReceived', message);
        console.log('Received message from client.js:', message);
    }
});

// Handle client.js process exit
clientProcess.on('exit', (code) => {
    logEvent('Gateway', 'ClientExit', `client.js exited with code: ${code}`);
    console.error('client.js exited with code:', code);
    sendStatusUpdate('client.js exited unexpectedly.');
    // Handle restarting client.js or other actions as needed
});

// Notify that the gateway is online initially
setTimeout(() => {
    sendStatusUpdate('Gateway is online');
}, 5000);

// Function to send status update as an embed message to a specific Discord channel
function sendStatusUpdate(statusMessage = 'Gateway status update') {
    const channelId = config.discord.statusChannelId;
    const channel = gatewayClient?.channels.cache.get(channelId);

    if (channel) {
        const embed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Gateway Status Update')
            .setDescription(statusMessage)
            .setTimestamp();

        channel.send({ embeds: [embed] })
            .then(() => logEvent('Gateway', 'StatusUpdateSent', `Status update sent to channel ${channelId}`))
            .catch(error => {
                logEvent('Gateway', 'StatusUpdateError', `Failed to send status update: ${error.message}`);
                console.error('Failed to send status update:', error);
            });
    } else {
        logEvent('Gateway', 'ChannelNotFoundError', `Channel ${channelId} not found.`);
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
gatewayClient = new Client();
gatewayClient.login(config.discord.gatewayToken)
    .then(() => {
        logEvent('Gateway', 'Login', `Logged in as ${gatewayClient.user.tag}`);
        console.log(`Logged in as ${gatewayClient.user.tag}`);
        startServerStatusMonitoring(); // Start server status monitoring after login
    })
    .catch(error => {
        logEvent('Gateway', 'LoginError', `Failed to login: ${error.message}`);
        console.error('Failed to login:', error);
        sendStatusUpdate(`Gateway failed to login: ${error.message}`);
    });

// Start server status monitoring
function startServerStatusMonitoring() {
    setInterval(() => {
        const statusMessage = `Server status update: ${new Date().toLocaleTimeString()}`;
        sendStatusUpdate(statusMessage);
    }, 60000); // Update status every 60 seconds
}
