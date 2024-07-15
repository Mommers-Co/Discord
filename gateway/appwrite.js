// appwrite.js
const { Appwrite } = require('appwrite');
const config = require('../config.json');

let appwriteClient;

function initializeAppwriteClient() {
    try {
        appwriteClient = new Appwrite();

        // Read configuration from config.json
        const { endpoint, projectId, apiKey } = config.appwrite;

        // Set endpoint, project ID, and API key
        appwriteClient
            .setEndpoint(endpoint)
            .setProject(projectId)
            .setKey(apiKey);

        console.log('Appwrite client initialized');
    } catch (error) {
        console.error('Failed to initialize Appwrite client:', error);
        throw error; // Throw error for better error handling in client.js
    }
}

function getAppwriteClient() {
    if (!appwriteClient) {
        throw new Error('Appwrite client not initialized');
    }
    return appwriteClient;
}

module.exports = { initializeAppwriteClient, getAppwriteClient };
