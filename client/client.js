const { Client, MessageEmbed, Intents } = require('discord.js');
const { logEvent, sendStatusUpdate } = require('../shared/logger');
const config = require('../config.json');
const { Client: AppwriteClient } = require('node-appwrite');
const path = require('path');
const fs = require('fs');
const { GatewayIntentBits } = require('@discordjs/builders');

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Initialize Appwrite client
const appwriteClient = new AppwriteClient();
appwriteClient
    .setEndpoint(config.appwrite.endpoint)
    .setProject(config.appwrite.projectId)
    .setKey(config.appwrite.apiKey);

// Function to interact with Appwrite service
async function fetchUserData(userId) {
    try {
        const response = await appwriteClient.database.listDocuments('users', ['userId', '==', userId]);
        return response.documents;
    } catch (error) {
        console.error('Failed to fetch user data:', error);
        throw error;
    }
}

// Load commands from the commands directory
client.commands = new Map();
const commandsDir = path.join(__dirname, 'commands');

if (fs.existsSync(commandsDir)) {
    const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(path.join(commandsDir, file));
        client.commands.set(command.name, command);
    }
} else {
    console.warn(`Commands directory not found: ${commandsDir}`);
}

// Event listeners
client.once('ready', () => {
    logEvent('Client', 'Ready', { user: client.user.tag });
    console.log(`Logged in as ${client.user.tag}`);
    sendStatusUpdate(client, 'Bot is online');
});

client.on('guildMemberAdd', member => {
    logEvent('Client', 'GuildMemberAdd', { member: member.user.tag });
});

client.on('guildMemberRemove', member => {
    logEvent('Client', 'GuildMemberRemove', { member: member.user.tag });
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.content.startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
        await command.execute(message, args);
    } catch (error) {
        console.error('Error executing command:', error);
        message.reply('There was an error executing that command.');
    }
});

// Listen for messages from gateway.js to start client operations
process.on('message', message => {
    if (message === 'StartClient') {
        client.login(config.discord.clientToken)
            .then(() => {
                logEvent('Client', 'Login', `Logged in as ${client.user.tag}`);
                fetchUserData('12345')
                    .then(data => {
                        logEvent('Client', 'FetchUserData', data);
                        console.log('Fetched user data:', data);
                        process.send('ClientOnline');
                    })
                    .catch(error => {
                        logEvent('Client', 'FetchUserDataError', `Failed to fetch user data: ${error.message}`);
                        console.error('Error fetching user data:', error);
                        process.send(`ClientError: ${error.message}`);
                    });
            })
            .catch(error => {
                logEvent('Client', 'LoginError', `Failed to login: ${error.message}`);
                console.error('Failed to login:', error);
                process.send(`ClientError: ${error.message}`);
            });
    }
});

module.exports = { client };
