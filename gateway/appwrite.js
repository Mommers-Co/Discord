require('dotenv').config();
const sdk = require('node-appwrite');
const moment = require('moment'); // For date manipulation

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
            [sdk.Query.equal("discordUserId", discordUserId)] // Filter by discordUserId
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

// Function to add all current Discord users who joined before today
const addAllCurrentUsers = async (guild) => {
    try {
        const today = moment().startOf('day');
        const members = await guild.members.fetch();
        
        for (const [_, member] of members) {
            const joinedAt = moment(member.joinedAt);
            if (joinedAt.isBefore(today)) {
                const user = {
                    discordUserId: member.id,
                    username: member.user.tag,
                    JoinedAt: joinedAt.toISOString(),
                    verifiedStatus: false, // Default value
                    verificationDate: null,
                    lastActive: new Date().toISOString(),
                    roles: member.roles.cache.map(role => role.id),
                    warnings: 0,
                    bans: 0,
                    lastAction: null,
                    notes: '',
                    ticketIds: [],
                    discordCreation: member.user.createdAt.toISOString(),
                };

                try {
                    await addUserToDatabase(user);
                    console.log(`User ${member.user.tag} added to the database.`);
                } catch (error) {
                    console.error(`Error adding user ${member.user.tag} to database: ${error.message}`);
                }
            }
        }
    } catch (error) {
        console.error('Error adding all current users to Appwrite:', error);
    }
};

// Function to constantly update the database (e.g., every hour)
const startDatabaseUpdater = (guild) => {
    setInterval(async () => {
        try {
            await addAllCurrentUsers(guild);
            console.log('Database updated with current users.');
        } catch (error) {
            console.error('Error updating database:', error);
        }
    }, 300000); // Update every hour (3600000 ms)
};

module.exports = { addUserToDatabase, getUserByDiscordId, updateUserStatus, startDatabaseUpdater };
