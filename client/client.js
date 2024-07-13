const { Client, Intents } = require('discord.js');
const { logEvent, sendStatusUpdate } = require('./shared/logger');
const config = require('./config.json');
const { createClient } = require('appwrite');
const path = require('path');
const fs = require('fs');

// Initialize Discord client
const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_MESSAGES
        // Add other intents as needed
    ]
});

// Initialize Appwrite client
const appwriteClient = createClient({
    endpoint: config.appwrite.endpoint,
    project: config.appwrite.projectId,
    apiKey: config.appwrite.apiKey,
});

// Example function to interact with Appwrite service
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
    sendStatusUpdate('Bot is online');
    // Additional client-side operations upon login
});

client.on('guildMemberAdd', () => {
    // Handle member add event if necessary
});

client.on('guildMemberRemove', () => {
    // Handle member remove event if necessary
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

// Login the Discord bot
client.login(config.discord.token)
    .then(() => {
        logEvent('Client', 'Login', `Logged in as ${client.user.tag}`);
        // Example: Fetch user data from Appwrite after login
        fetchUserData('12345')
            .then(data => console.log('Fetched user data:', data))
            .catch(error => console.error('Error fetching user data:', error));
        // Additional operations after login if needed
    })
    .catch(error => {
        logEvent('Client', 'LoginError', `Failed to login: ${error.message}`);
        console.error('Failed to login:', error);
    });

module.exports = { client };
