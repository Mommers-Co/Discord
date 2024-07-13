const { Client, Intents } = require('discord.js');
const { logEvent, sendErrorToChannel } = require('./logger');
const { fork } = require('child_process');

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_MESSAGES
        // Add other intents as needed
    ]
});

client.commands = new Map();

// Load configuration
const fs = require('fs');
const path = require('path');
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

// Load commands from the commands directory
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
process.on('message', message => {
    if (message === 'BotLoggedIn') {
        console.log('Received BotLoggedIn message from gateway.js');
        startClientOperations();
    }
});

function startClientOperations() {
    client.once('ready', () => {
        console.log(`Logged in as ${client.user.tag}`);
        // Do any additional client-side operations upon bot login
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
}

// Export client for external use if needed
module.exports = { client };

// Check if gateway.js is offline
const gatewayProcess = fork('./gateway.js');

gatewayProcess.on('exit', (code) => {
    console.error('gateway.js is offline.');
    sendGatewayOfflineStatus();
});

function sendGatewayOfflineStatus() {
    const channelId = config.discord.statusChannelId; // Replace with your actual status channel ID
    const channel = client.channels.cache.get(channelId);

    if (channel) {
        channel.send('gateway.js is offline.')
            .then(() => console.log(`Sent offline status to channel ${channelId}`))
            .catch(error => console.error('Failed to send offline status:', error));
    } else {
        console.error(`Channel ${channelId} not found.`);
    }
}
