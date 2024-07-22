require('dotenv').config();
const sdk = require('node-appwrite');

const client = new sdk.Client();
const databases = new sdk.Databases(client);

const config = require('../config.json'); 

// Initialize the Appwrite client
client
    .setEndpoint(config.appwrite.endpoint) // Appwrite endpoint
    .setProject(config.appwrite.projectId) // Appwrite project ID
    .setKey(config.appwrite.apiKey); // Appwrite API key

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

// Define the function to get a user by discordUserId
const getUserByDiscordId = async (discordUserId) => {
    try {
        const response = await databases.listDocuments(
            config.appwrite.discordDatabase.discordDatabaseId, // discordDatabase ID
            config.appwrite.discordDatabase.usersCollectionId, // Users Collection ID
            [`equal("discordUserId", "${discordUserId}")`] // Filter by discordUserId
        );
        if (response.documents.length > 0) {
            return response.documents[0];
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error fetching user from Appwrite:', error);
        throw error;
    }
};

// Define the function to update the user's status
const updateUserStatus = async (discordUserId, updateData) => {
    try {
        const user = await getUserByDiscordId(discordUserId);
        if (!user) {
            throw new Error(`User with discordUserId ${discordUserId} not found`);
        }
        const response = await databases.updateDocument(
            config.appwrite.discordDatabase.discordDatabaseId, // discordDatabase ID
            config.appwrite.discordDatabase.usersCollectionId, // Users Collection ID
            user.$id, // User document ID
            updateData
        );
        return response;
    } catch (error) {
        console.error('Error updating user in Appwrite:', error);
        throw error;
    }
};

module.exports = { addUserToDatabase, getUserByDiscordId, updateUserStatus, databases };
