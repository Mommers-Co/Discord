const { Client, GatewayIntentBits } = require('discord.js');
const { Client: AppwriteClient } = require('node-appwrite'); // Ensure the correct module is imported
const config = require('../config.json'); // Load config.json from the directory
const { logEvent } = require('../shared/logger'); // Import shared logger module

// Function to initialize Appwrite client
async function initializeAppwriteClient() {
    try {
        const appwriteClient = new AppwriteClient();
        appwriteClient
            .setEndpoint(config.appwrite.endpoint)
            .setProject(config.appwrite.projectId)
            .setKey(config.appwrite.apiKey);

        logEvent('Gateway', 'AppwriteClient', 'Appwrite client initialized successfully');
        console.log('Appwrite client initialized successfully');
        return appwriteClient;
    } catch (error) {
        logEvent('Gateway', 'AppwriteClientError', `Failed to initialize Appwrite client: ${error.message}`);
        console.error('Failed to initialize Appwrite client:', error);
        throw error;
    }
}

module.exports = { initializeAppwriteClient };
