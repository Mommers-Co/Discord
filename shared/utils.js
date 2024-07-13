// utils.js
const { MessageEmbed } = require('discord.js');
const config = require('../config.json');

// Function to send status update to Discord channel
function sendStatusUpdate(client, statusMessage = 'Status update') {
    const channelId = config.discord.statusChannelId;

    if (client) {
        const channel = client.channels.cache.get(channelId);

        if (channel) {
            const embed = new MessageEmbed()
                .setColor('#0099ff')
                .setTitle('Gateway Status Update')
                .setDescription(statusMessage)
                .setTimestamp();

            channel.send({ embeds: [embed] })
                .then(() => console.log(`[${new Date().toLocaleString()}] Status update sent to channel ${channelId}`))
                .catch(error => console.error(`[${new Date().toLocaleString()}] Failed to send status update: ${error}`));
        } else {
            console.error(`[${new Date().toLocaleString()}] Channel ${channelId} not found.`);
        }
    } else {
        console.error(`[${new Date().toLocaleString()}] Discord client not initialized.`);
    }
}

module.exports = { sendStatusUpdate };
