const { Client, MessageEmbed } = require('discord.js');
const config = require('../config.json');

let gatewayClient; // Declare gatewayClient globally

// Function to initialize the Discord client
function initDiscordClient() {
    if (!gatewayClient) {
        gatewayClient = new Client();
        gatewayClient.login(config.discord.gatewayToken)
            .then(() => console.log(`[${new Date().toLocaleString()}] Gateway Client logged in as ${gatewayClient.user.tag}`))
            .catch(error => console.error(`[${new Date().toLocaleString()}] Failed to login to Discord: ${error.message}`));
    }
}

// Function to log events with a timestamp
function logEvent(moduleName, eventName, eventData) {
    console.log(`[${new Date().toLocaleString()}] [${moduleName}] Event: ${eventName}`, eventData);
}

// Function to send status update to Discord channel
function sendStatusUpdate(statusMessage = 'Status update') {
    initDiscordClient();

    const channelId = config.discord.statusChannelId;

    if (gatewayClient) {
        const channel = gatewayClient.channels.cache.get(channelId);

        if (channel) {
            const embed = new MessageEmbed()
                .setColor('#0099ff')
                .setTitle('Gateway Status Update')
                .setDescription(statusMessage)
                .setTimestamp();

            channel.send({ embeds: [embed] })
                .then(() => console.log(`[${new Date().toLocaleString()}] Status update sent to channel ${channelId}`))
                .catch(error => console.error('Failed to send status update:', error));
        } else {
            console.error(`[${new Date().toLocaleString()}] Channel ${channelId} not found.`);
        }
    } else {
        console.error(`[${new Date().toLocaleString()}] Discord client not initialized.`);
    }
}

module.exports = { logEvent, sendStatusUpdate };
