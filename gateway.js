const fs = require('fs');
const { Client, GatewayIntentBits } = require('discord.js');
const appwrite = require('node-appwrite');

// Load configuration
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    logEvent('BotReady', { message: `Bot logged in as ${client.user.tag}` });

    // Set initial status
    await updateMemberStatus();
});

const sdk = new appwrite.Client();
sdk
    .setEndpoint(config.appwrite.endpoint) // Your Appwrite Endpoint
    .setProject(config.appwrite.projectId) // Your project ID
    .setKey(config.appwrite.apiKey); // Your secret API key

async function logEvent(event, data) {
    const databases = new appwrite.Databases(sdk);

    try {
        await databases.createDocument(config.appwrite.databaseId, config.appwrite.collectionId, 'unique()', {
            event, // String attribute
            data, // JSON attribute
            timestamp: new Date().toISOString() // String attribute
        });
    } catch (error) {
        console.error('Failed to log event:', error);
        sendErrorToChannel(`Failed to log event: ${error.message}`);
    }
}

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    logEvent('MessageCreate', { content: message.content, author: message.author.tag, channel: message.channel.id });

    if (message.content.startsWith('!save')) {
        const data = message.content.split(' ').slice(1).join(' ');

        const databases = new appwrite.Databases(sdk);

        try {
            const response = await databases.createDocument(config.appwrite.databaseId, config.appwrite.collectionId, 'unique()', { message: data });
            message.reply('Data saved successfully!');
            logEvent('DataSaved', { message: data });
        } catch (error) {
            console.error('Failed to save data:', error);
            message.reply('Failed to save data.');
            sendErrorToChannel(`Failed to save data: ${error.message}`);
            logEvent('DataSaveError', { error: error.message, message: data });
        }
    }
});

client.on('error', (error) => {
    console.error('Discord client error:', error);
    sendErrorToChannel(`Discord client error: ${error.message}`);
    logEvent('ClientError', { error: error.message });
});

client.login(config.discord.token)
    .catch(error => {
        console.error('Failed to login:', error);
        sendErrorToChannel(`Failed to login: ${error.message}`);
        logEvent('LoginError', { error: error.message });
    });

async function updateMemberStatus() {
    try {
        const guild = client.guilds.cache.first(); // Assuming the bot is only in one guild
        if (!guild) return;

        const members = await guild.members.fetch();
        const memberCount = members.filter(member => !member.user.bot).size;

        client.user.setPresence({
            activities: [{ name: `serving ${memberCount} members` }],
            status: 'online'
        });

        logEvent('StatusUpdate', { memberCount });

    } catch (error) {
        console.error('Failed to update member status:', error);
        sendErrorToChannel(`Failed to update member status: ${error.message}`);
        logEvent('StatusUpdateError', { error: error.message });
    }
}

function sendErrorToChannel(errorMessage) {
    const errorChannel = client.channels.cache.get(config.discord.consoleId);
    if (errorChannel) {
        const embed = {
            color: 0xff0000, // Red color
            title: 'Error',
            description: errorMessage,
            timestamp: new Date(),
            footer: {
                text: 'Error Logger'
            }
        };
        errorChannel.send({ embeds: [embed] }).catch(err => {
            console.error('Failed to send error message to channel:', err);
            logEvent('ErrorMessageSendError', { error: err.message, originalError: errorMessage });
        });
    } else {
        console.error('Error channel not found');
        logEvent('ErrorChannelNotFound', { error: errorMessage });
    }
}
