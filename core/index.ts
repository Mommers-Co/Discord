import CustomClient from './customClient';
import { GatewayIntentBits, ActivityType, Collection, Client } from 'discord.js';
import fs from 'fs';
import Logger from './logger';
import Database from './database';
import UserService from './userService';
import { GuildSettings } from './types';

// Load the configuration (with guild settings from config.json)
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

// Instance of the Discord client
const client = new CustomClient({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers],
});

// Add a guildSettings cache to the client (this should work now, since we extended CustomClient)
client.guildSettings = new Collection<string, any>(); // Using 'any' to hold dynamic guild settings

// When the client is ready (logged in)
client.once('ready', async () => {
    Logger.info(`Logged in as ${client.user?.tag}`);

    try {
        // Connect to the database
        await Database.connect();

        // Load guild settings from config.json and set them in the cache
        for (const guildId in config.discord) {
            const guildConfig = config.discord[guildId];

            // Only add guilds that have settings defined in config.json
            if (guildConfig.guildId) {
                client.guildSettings.set(guildId, guildConfig);
            }
        }

        Logger.info(`Loaded settings for ${client.guildSettings.size} guild(s).`);

        // Log the loaded guild settings for debugging
        client.guildSettings.forEach((guildConfig, guildId) => {
            Logger.info(`Loaded config for guild: ${guildId}`);
            Logger.info(`Guild settings: ${JSON.stringify(guildConfig, null, 2)}`);
        });

        // Fetch all guilds and their members, and ensure users are added to the database
        const guildsFetched = await client.guilds.fetch(); // Returns Collection<string, OAuth2Guild>

        // Explicitly handle OAuth2Guilds and fetch the full Guild object
        for (const oauthGuild of guildsFetched.values()) {
            try {
                // Fetch the full Guild object using the OAuth2Guild ID
                const guild = await client.guilds.fetch(oauthGuild.id);

                // Fetch guild members
                const members = await guild.members.fetch();
                for (const member of members.values()) {
                    try {
                        await UserService.ensureUserExists(client, member);  // Pass client and member
                    } catch (error) {
                        Logger.error(`Error ensuring user ${member.id} exists in DB : ${error}`);
                    }
                };
            } catch (error) {
                Logger.error(`Error fetching full guild for ${oauthGuild.name} (${oauthGuild.id}): ${error}`);
            }
        }

        // Update presence for each guild dynamically
        updatePresence(client);

    } catch (error: unknown) {
        if (error instanceof Error) {
            Logger.error(`Error while connecting to the database or loading guild settings: ${error.message}`);
        } else {
            Logger.error(`Unknown error while loading guild settings: ${error}`);
        }
    }
});

// Function to update the bot's presence with the number of non-bot members
const updatePresence = (client: CustomClient) => {
    // Iterate over each guild the bot is a part of
    client.guilds.cache.forEach((guild) => {
        // Get the number of non-bot members for this guild
        const memberCount = guild.members.cache.filter((member) => !member.user.bot).size;

        // Retrieve the guild settings from config.json
        const guildConfig = client.guildSettings.get(guild.id);

        // If guild settings exist in config.json, dynamically update the bot's presence for this guild
        if (guildConfig) {
            const guildName = guildConfig.guildId || guild.name;

            // Set the presence for the bot (e.g., Watching 48 Members in Mommers Co)
            client.user?.setPresence({
                activities: [{
                    name: `Watching ${memberCount} Members in ${guildName}`,
                    type: ActivityType.Watching, // Use ActivityType.Watching here
                }],
                status: 'online', // You can customize this to 'dnd' (Do Not Disturb), 'idle', etc.
            });

            Logger.info(`Set presence for ${guildName}: Watching ${memberCount} Members.`);
        }
    });
};

// Log in using the bot token from the config
client.login(config.discord.botToken).catch((err) => {
    Logger.error(`Failed to log in: ${err.message}`);
});
