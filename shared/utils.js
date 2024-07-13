const { MessageEmbed } = require('discord.js');
const config = require('./config.json');

function sendStatusUpdate(client, statusMessage = 'Status update') {
    const channelId = config.discord.statusChannelId;
    const channel = client.channels.cache.get(channelId);

    if (channel) {
        const embed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Status Update')
            .setDescription(statusMessage)
            .setTimestamp();

        channel.send({ embeds: [embed] })
            .then(() => console.log(`Status update sent to channel ${channelId}`))
            .catch(error => console.error('Failed to send status update:', error));
    } else {
        console.error(`Channel ${channelId} not found.`);
    }
}

module.exports = { sendStatusUpdate };
