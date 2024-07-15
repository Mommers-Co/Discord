const { Client } = require('appwrite');
const config = require('../config.json');

let appwriteClient;

function initializeAppwriteClient() {
    appwriteClient = new Client();
    appwriteClient
        .setEndpoint(config.appwrite.endpoint)
        .setProject(config.appwrite.projectId)
        .setKey(config.appwrite.apiKey);
    return appwriteClient;
}

function getAppwriteClient() {
    if (!appwriteClient) {
        throw new Error('Appwrite client is not initialized.');
    }
    return appwriteClient;
}

module.exports = { initializeAppwriteClient, getAppwriteClient };
