const { Client: AppwriteClient } = require('node-appwrite');
const config = require('../config.json');
const { logEvent } = require('../shared/logger');

// Function to initialize Appwrite client
async function initializeAppwriteClient() {
    try {
        const appwriteClient = new AppwriteClient()
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
