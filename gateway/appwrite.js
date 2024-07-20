require('dotenv').config();
const sdk = require('node-appwrite');

const client = new sdk.Client();
const databases = new sdk.Databases(client);

const config = require('../config.json'); 

// Initialize the Appwrite client
client
    .setEndpoint(config.appwrite.endpoint) // Appwrite endpoint
    .setProject(config.appwrite.projectId) // Appwrite project ID
    .setKey(config.appwrite.apiKey); // ppwrite API key

// Define the function to add a user to the database
const addUserToDatabase = async (user) => {
    try {
        // Create a document in the usersCollectionId
        const response = await databases.createDocument(
            config.appwrite.discordDatabase.discordDatabaseId, // discordDatabase ID
            config.appwrite.discordDatabase.usersCollectionId, // Users Collection ID
            'unique()', // Generate a unique ID
            {
                discordUserId: user.discordUserId,
                username: user.username,
                JoinedAt: user.JoinedAt,
                verifiedStatus: user.verifiedStatus,
                verificationDate: user.verificationDate,
                lastActive: user.lastActive,
                roles: user.roles,
                warnings: user.warnings,
                bans: user.bans,
                lastAction: user.lastAction,
                notes: user.notes,
                ticketIds: user.ticketIds,
                discordCreation: user.discordCreation,
            }
        );
        return response;
    } catch (error) {
        console.error('Error adding user to Appwrite:', error);
        throw error;
    }
};

module.exports = { addUserToDatabase, databases };
