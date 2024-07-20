const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('../config.json');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ], 
    partials: [Partials.Channel] 
});

client.once('ready', () => {
    console.log('Client is online!');
});

client.login(config.discord.botToken).catch(error => {
    console.error('Failed to login:', error);
});

module.exports = client;
