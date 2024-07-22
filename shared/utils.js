const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');

// Object to store the message ID of the last status update
let lastStatusMessageId = null;

// Function to send or update the status update to Discord channel
async function sendStatusUpdate(client, statusMessage = 'Status update') {
    const channelId = config.discord.systemAlertsId;

    if (client) {
        const channel = client.channels.cache.get(channelId);

        if (channel) {
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('System Alert!')
                .setDescription(statusMessage)
                .setTimestamp();

            try {
                if (lastStatusMessageId) {
                    // Try to fetch the last status message
                    const message = await channel.messages.fetch(lastStatusMessageId);
                    if (message) {
                        // Edit the existing message
                        await message.edit({ embeds: [embed] });
                        console.log(`[${new Date().toLocaleString()}] Status update edited in channel ${channelId}`);
                    } else {
                        // If the message is not found, send a new one
                        const sentMessage = await channel.send({ embeds: [embed] });
                        lastStatusMessageId = sentMessage.id;
                        console.log(`[${new Date().toLocaleString()}] Status update sent to channel ${channelId}`);
                    }
                } else {
                    // If no previous message ID, send a new one
                    const sentMessage = await channel.send({ embeds: [embed] });
                    lastStatusMessageId = sentMessage.id;
                    console.log(`[${new Date().toLocaleString()}] Status update sent to channel ${channelId}`);
                }
            } catch (error) {
                console.error(`[${new Date().toLocaleString()}] Failed to send/edit status update: ${error}`);
                lastStatusMessageId = null; // Reset the message ID if there's an error
            }
        } else {
            console.error(`[${new Date().toLocaleString()}] Channel ${channelId} not found.`);
        }
    } else {
        console.error(`[${new Date().toLocaleString()}] Status client not initialized.`);
    }
}

module.exports = { sendStatusUpdate };
