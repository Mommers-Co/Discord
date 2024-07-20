require('dotenv').config();
const { Client, Databases } = require('appwrite');
const config = require('../config.json'); // Update the path as necessary

const client = new Client()
    .setEndpoint(config.appwrite.endpoint) // Ensure this is correctly set
    .setProject(config.appwrite.projectId)

const databases = new Databases(client);

const addUserToDatabase = async (user) => {
    try {
        await databases.createDocument(
            config.appwrite.discordDatabase.discordDatabaseId,
            config.appwrite.discordDatabase.usersCollectionId, // Specify the collection ID here
            'unique()', // Generate a unique ID for the document
            {
                email: user.email,
                username: user.username,
                discordId: user.discordId,
                joinedAt: new Date().toISOString()
            }
        );
    } catch (error) {
        console.error('Error adding user to database:', error);
    }
};

module.exports = { addUserToDatabase };
