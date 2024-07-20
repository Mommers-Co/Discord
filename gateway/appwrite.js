require('dotenv').config();
const sdk = require('node-appwrite');

const client = new sdk.Client();
const databases = new sdk.Databases(client);

const config = require('../config.json'); // Update the path as necessary

// Initialize the Appwrite client
client
    .setEndpoint(config.appwrite.endpoint) // Your Appwrite endpoint
    .setProject(config.appwrite.projectId) // Your Appwrite project ID
    .setKey(config.appwrite.apiKey); // Your Appwrite API key

// Define the function to add a user to the database
const addUserToDatabase = async (user) => {
    try {
        // Create a document in the usersCollectionId
        const response = await databases.createDocument(
            config.appwrite.databaseId, // Your database ID
            config.appwrite.usersCollectionId, // Your collection ID
            user.discordUserId, // Document ID (using discordUserId here)
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
                registeredEmail: user.registeredEmail
            }
        );
        return response;
    } catch (error) {
        console.error('Error adding user to Appwrite:', error);
        throw error;
    }
};

module.exports = { addUserToDatabase };
