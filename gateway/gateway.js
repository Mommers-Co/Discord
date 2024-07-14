const { Client, GatewayIntentBits } = require('discord.js');
const { logEvent } = require('../shared/logger');
const { fork } = require('child_process');
const path = require('path');
const config = require('../config.json');
const { initializeAppwriteClient, getAppwriteClient } = require('./appwrite');

console.log('Starting gateway...');

// Initialize Discord client
const gatewayIntents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContents
];

const gatewayClient = new Client({ 
    intents: gatewayIntents,
    allowedMentions: { parse: ['users', 'roles'], repliedUser: true }
});

// Function to start the Discord client
async function startDiscordClient() {
    try {
        await gatewayClient.login(config.discord.clientToken);
        logEvent('Gateway', 'Login', `Logged in as ${gatewayClient.user.tag}`);
        console.log(`Logged in as ${gatewayClient.user.tag}`);
        initializeClientProcess(); // Start client.js after Discord client is online
    } catch (error) {
        handleClientError('Gateway', 'LoginError', 'Failed to login', error);
        setTimeout(restartDiscordClient, 30000); // Restart client after 30 seconds
    }
}

// Function to initialize client.js process as a child process
function initializeClientProcess() {
    try {
        console.log('Initializing client.js process...');
        const clientProcess = fork(path.join(__dirname, '..', '..', 'client', 'client.js'));

        clientProcess.on('message', message => {
            if (message === 'ClientOnline') {
                logEvent('Gateway', 'ClientOnline', 'Successfully connected with client.js');
            } else if (message.startsWith('ClientError:')) {
                handleClientError('Gateway', 'ClientError', 'Error from client.js', message.slice('ClientError:'.length).trim());
            } else {
                logEvent('Gateway', 'MessageReceived', message);
                console.log('Received message from client.js:', message);
            }
        });

        clientProcess.on('exit', code => {
            logEvent('Gateway', 'ClientExit', `client.js exited with code: ${code}`);
            restartClientProcess();
        });

        // Send message to client.js to start
        clientProcess.send('StartClient');

    } catch (error) {
        handleClientError('Gateway', 'ClientProcessError', 'Error starting client.js process', error);
        setTimeout(restartClientProcess, 30000); // Restart client.js process after 30 seconds
    }
}

// Function to restart the client.js process
function restartClientProcess() {
    console.log('Restarting client.js process...');
    setTimeout(initializeClientProcess, 30000);
}

// Function to restart the Discord client
function restartDiscordClient() {
    console.log('Restarting Discord client...');
    setTimeout(startDiscordClient, 30000); // Restart Discord client after 30 seconds
}

// Global error handler for uncaught exceptions
process.on('uncaughtException', err => {
    handleClientError('Gateway', 'UncaughtException', 'Uncaught Exception', err);
});

// Start the gateway by initializing Appwrite client and logging into Discord
async function initializeAndStartGateway() {
    try {
        await initializeAppwriteClient();
        await startDiscordClient();
    } catch (error) {
        handleClientError('Gateway', 'InitializationError', 'Failed to initialize Appwrite client or start Discord client', error);
        process.exit(1); // Exit the process with an error code
    }
}

function handleClientError(module, event, message, error) {
    const errorMessage = error instanceof Error ? error.message : error;
    logEvent(module, event, `${message}: ${errorMessage}`);
    console.error(message, error);
}

initializeAndStartGateway();

module.exports = { gatewayClient };
