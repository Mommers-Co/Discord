const { Appwrite } = require('appwrite');
const config = require('../config.json'); // Adjust the path as needed

let appwriteClient;

function initializeAppwriteClient() {
    appwriteClient = new Appwrite();

    // Read configuration from config.json
    const { endpoint, projectId, apiKey } = config.appwrite;

    // Set endpoint, project ID, and API key
    appwriteClient
        .setEndpoint(endpoint)
        .setProject(projectId)
        .setKey(apiKey);

    return appwriteClient;
}

function getAppwriteClient() {
    if (!appwriteClient) {
        throw new Error('Appwrite client not initialized');
    }
    return appwriteClient;
}

module.exports = { initializeAppwriteClient, getAppwriteClient };
