const { Client, Intents } = require('discord.js');
const { logEvent } = require('../shared/logger'); // Import logEvent and sendStatusUpdate from logger
const { fork } = require('child_process');
const path = require('path');
const config = require('../config.json'); // Load config.json from the directory
const { createClient } = require('appwrite'); // Import createClient from appwrite

let gatewayClient;
let clientProcess;

// Function to initialize Appwrite client
async function initializeAppwriteClient() {
    try {
        const appwriteClient = createClient({
            endpoint: config.appwrite.endpoint,
            project: config.appwrite.projectId,
            apiKey: config.appwrite.apiKey,
        });
        logEvent('Gateway', 'AppwriteClient', 'Appwrite client initialized successfully');
        startDiscordClient(); // Start Discord client after initializing Appwrite client
    } catch (error) {
        logEvent('Gateway', 'AppwriteClientError', `Failed to initialize Appwrite client: ${error.message}`);
        console.error('Failed to initialize Appwrite client:', error);
        await restartGateway('Appwrite client initialization failed');
    }
}

// Function to start the client.js process as a child process
function startClientProcess() {
    clientProcess = fork(path.join(__dirname, '..', 'client', 'client.js'));

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

    clientProcess.on('exit', (code) => {
        logEvent('Gateway', 'ClientExit', `client.js exited with code: ${code}`);
        console.error('client.js exited with code:', code);
        sendStatusUpdate('client.js exited unexpectedly.');
        restartClientProcess(); // Restart client.js
    });
}

// Function to restart the client.js process
function restartClientProcess() {
    console.log('Restarting client.js process...');
    setTimeout(() => {
        startClientProcess();
    }, 5000); // Delayed restart after 5 seconds
}

// Function to start the Discord client
function startDiscordClient() {
    gatewayClient = new Client({ intents: Object.values(Intents.FLAGS) });

    gatewayClient.login(config.discord.gatewayToken)
        .then(() => {
            logEvent('Gateway', 'Login', `Logged in as ${gatewayClient.user.tag}`);
            console.log(`Logged in as ${gatewayClient.user.tag}`);
            startGateway(); // Start gateway operations after login
        })
        .catch(error => {
            logEvent('Gateway', 'LoginError', `Failed to login: ${error.message}`);
            console.error('Failed to login:', error);
            restartDiscordClient();
        });
}

// Function to restart the Discord client
function restartDiscordClient() {
    console.log('Restarting Discord client...');
    setTimeout(() => {
        startDiscordClient();
    }, 5000); // Delayed restart after 5 seconds
}

// Function to start gateway operations
function startGateway() {
    startClientProcess(); // Start client.js process
    startServerStatusMonitoring(); // Start server status monitoring
    sendMessageToClient('StartClient'); // Signal client.js to start
}

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
        // Fallback logging if channel is not found
        logEvent('Gateway', 'StatusUpdateError', `Failed to send status update: Channel ${channelId} not found.`);
        console.error('Failed to send status update: Channel', channelId, 'not found.');
    }
}

// Function to send messages to client.js if needed
function sendMessageToClient(message) {
    if (clientProcess) {
        clientProcess.send(message);
    } else {
        console.error('clientProcess is undefined. Cannot send message:', message);
    }
}

// Example: Sending a message to client.js
setTimeout(() => {
    sendMessageToClient('Hello from gateway.js');
}, 5000);

// Function to start server status monitoring
function startServerStatusMonitoring() {
    setInterval(() => {
        const statusMessage = `Server status update: ${new Date().toLocaleTimeString()}`;
        sendStatusUpdate(statusMessage);
    }, 60000); // Update status every 60 seconds
}

// Function to restart the gateway on error
async function restartGateway(reason) {
    logEvent('Gateway', 'Restarting', `Restarting gateway due to: ${reason}`);
    console.log(`Restarting gateway due to: ${reason}`);

    // Clean up existing resources if needed
    if (clientProcess) {
        clientProcess.kill('SIGINT'); // Kill the client process
    }
    if (gatewayClient) {
        await gatewayClient.destroy(); // Destroy the Discord client
    }

    // Delay before restarting
    setTimeout(() => {
        initializeAppwriteClient(); // Reinitialize the gateway
    }, 10000); // Delayed restart after 10 seconds
}

// Initial Appwrite client initialization
initializeAppwriteClient();

// Import necessary modules and setup configurations

// Add a global error handler for uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Handle or log the error as needed
    process.exit(1); // Exit process after handling
});

// Ensure log and export directories exist

// Function to initialize Appwrite client and start operations
async function initializeAppwriteClient() {
    try {
        // Initialize Appwrite client and start necessary processes
    } catch (error) {
        console.error('Failed to initialize Appwrite client:', error);
        process.exit(1); // Exit process on initialization error
    }
}

// Function to start Discord client and handle login
function startDiscordClient() {
    try {
        // Start Discord client login process and handle errors
    } catch (error) {
        console.error('Failed to login to Discord:', error);
        process.exit(1); // Exit process on login error
    }
}

// Function to start gateway operations after clients are initialized
function startGateway() {
    try {
        initializeAppwriteClient();
        startDiscordClient();
        // Add other operations as needed
    } catch (error) {
        console.error('Error starting gateway operations:', error);
        process.exit(1); // Exit process on startup error
    }
}

// Start gateway operations when script is executed
startGateway();


module.exports = { sendStatusUpdate }; // Export sendStatusUpdate if needed externally
