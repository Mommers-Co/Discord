const { initializeAppwriteClient } = require('./appwriteInit');
const { Client, GatewayIntentBits } = require('discord.js');
const { logEvent } = require('../shared/logger');
const { fork } = require('child_process');
const path = require('path');
const config = require('../config.json');

let gatewayClient;
let clientProcess;
let appwriteClient;

console.log('Starting gateway...');

// Function to start the Discord client
function startDiscordClient() {
    try {
        const intents = [
            GatewayIntentBits.GUILDS,
            GatewayIntentBits.GUILD_MESSAGES,
            GatewayIntentBits.MESSAGE_CONTENT,
            GatewayIntentBits.GUILD_MEMBERS
        ];

        console.log('Intents:', intents);

        gatewayClient = new Client({ intents });

        gatewayClient.login(config.discord.gatewayToken)
            .then(() => {
                logEvent('Gateway', 'Login', `Logged in as ${gatewayClient.user.tag}`);
                console.log(`Logged in as ${gatewayClient.user.tag}`);
                startGateway();
            })
            .catch(error => {
                logEvent('Gateway', 'LoginError', `Failed to login: ${error.message}`);
                console.error('Failed to login:', error);
                restartDiscordClient();
            });
    } catch (error) {
        logEvent('Gateway', 'DiscordClientError', `Error starting Discord client: ${error.message}`);
        console.error('Error starting Discord client:', error);
    }
}

// Function to start the client.js process as a child process
function startClientProcess() {
    try {
        console.log('Starting client.js process...');
        clientProcess = fork(path.join(__dirname, '..', 'client.js'));

        clientProcess.on('message', message => {
            if (message === 'ClientOnline') {
                logEvent('Gateway', 'ClientOnline', 'Successfully connected with client.js');
            } else if (message.startsWith('ClientError:')) {
                const errorMessage = message.slice('ClientError:'.length).trim();
                logEvent('Gateway', 'ClientError', errorMessage);
                console.error('Error from client.js:', errorMessage);
            } else {
                logEvent('Gateway', 'MessageReceived', message);
                console.log('Received message from client.js:', message);
            }
        });

        clientProcess.on('exit', (code) => {
            logEvent('Gateway', 'ClientExit', `client.js exited with code: ${code}`);
            console.error('client.js exited with code:', code);
            restartClientProcess();
        });
    } catch (error) {
        logEvent('Gateway', 'ClientProcessError', `Error starting client.js process: ${error.message}`);
        console.error('Error starting client.js process:', error);
    }
}

// Function to restart the client.js process
function restartClientProcess() {
    console.log('Restarting client.js process...');
    setTimeout(() => {
        startClientProcess();
    }, 5000);
}

// Function to restart the Discord client
function restartDiscordClient() {
    console.log('Restarting Discord client...');
    setTimeout(() => {
        startDiscordClient();
    }, 5000);
}

// Function to start gateway operations
function startGateway() {
    console.log('Starting gateway operations...');
    startClientProcess();
}

// Function to restart the gateway on error
async function restartGateway(reason) {
    logEvent('Gateway', 'Restarting', `Restarting gateway due to: ${reason}`);
    console.log(`Restarting gateway due to: ${reason}`);

    if (clientProcess) {
        clientProcess.kill('SIGINT');
    }
    if (gatewayClient) {
        await gatewayClient.destroy();
    }

    setTimeout(() => {
        startDiscordClient();
    }, 10000);
}

// Initial Appwrite client initialization
initializeAppwriteClient()
    .then(client => {
        appwriteClient = client;
        startDiscordClient();
    })
    .catch(err => {
        console.error('Failed to initialize Appwrite client:', err);
        logEvent('Gateway', 'AppwriteInitializationError', err.message);
    });

// Global error handler for uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    logEvent('Gateway', 'UncaughtException', err.message);
});
