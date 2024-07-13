const appwrite = require('node-appwrite');
const fs = require('fs');

// Load configuration
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

const sdk = new appwrite.Client();
sdk
    .setEndpoint(config.appwrite.endpoint)
    .setProject(config.appwrite.projectId)
    .setKey(config.appwrite.apiKey);

async function logEvent(eventType, details) {
    const databases = new appwrite.Databases(sdk);

    try {
        await databases.createDocument(config.appwrite.databaseId, config.appwrite.collectionId, 'unique()', {
            eventType, // String attribute
            details: JSON.stringify(details), // Stringify the JSON attribute
            timestamp: new Date().toISOString() // String attribute
        });
    } catch (error) {
        console.error('Failed to log event:', error);
        // Handle the logging failure (e.g., send a message to a Discord channel)
    }
}

async function sendErrorToChannel(client, guildId, roleName, errorMessage) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
        console.error('Guild not found');
        return;
    }

    const role = guild.roles.cache.find(role => role.name === roleName);
    if (!role) {
        console.error(`Role '${roleName}' not found in guild '${guild.name}'`);
        return;
    }

    // Notify members with the specified role
    const membersWithRole = role.members.array();
    for (const member of membersWithRole) {
        try {
            await member.send(errorMessage);
        } catch (error) {
            console.error(`Failed to send error message to ${member.user.tag}:`, error);
        }
    }
}


module.exports = { logEvent };
