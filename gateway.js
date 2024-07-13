const fs = require('fs');
const appwrite = require('node-appwrite');
const { client, updateMemberStatus, sendErrorToChannel } = require('./client');
const { updateServerStatus, startServerStatusMonitoring } = require('./serverStatus'); // Correct import

const { logEvent } = require('./logger');


// Load configuration
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

const sdk = new appwrite.Client();
sdk
    .setEndpoint(config.appwrite.endpoint)
    .setProject(config.appwrite.projectId)
    .setKey(config.appwrite.apiKey);

client.once('ready', async () => {
    console.log(`${client.user.tag} Has Successfully passed the gateway`);
    logEvent('BotReady', { message: `Bot logged in as ${client.user.tag}` });
    
    // Set initial status
    await updateMemberStatus(client);
    startServerStatusMonitoring(client, config); // Call startServerStatusMonitoring here
});


client.login(config.discord.token)
    .catch(error => {
        console.error('Failed to login:', error);
        sendErrorToChannel(client, config.discord.errorChannelId, `Failed to login: ${error.message}\nError Type: ${error.type}\nError Code: ${error.code}`);
        logEvent('LoginError', { error: error.message });
    });
