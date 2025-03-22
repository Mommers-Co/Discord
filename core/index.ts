import CustomClient from './customClient';
import { Client, GatewayIntentBits, Collection, Guild, GuildMember, OAuth2Guild } from 'discord.js';
import fs from 'fs';
import Logger from './logger';
import Database from './database';
import UserService from './userService';  // Import the user service
import { handleCommandExecution } from './loader';

// Load the configuration
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

// Create an instance of the Discord client
const client = new CustomClient({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers], // Add necessary intents
});

// Add a guildSettings cache to the client
client.guildSettings = new Collection<string, any>();

// When the client is ready (logged in)
client.once('ready', async () => {
    Logger.info(`Logged in as ${client.user?.tag}`);

    try {
        // Connect to the database
        await Database.connect();

        // Load guild settings from the database and set them in the cache
        const guilds = await Database.getAllGuilds();
        guilds.forEach((guild: any) => {
            client.guildSettings.set(guild.id, guild.settings);
        });

        Logger.info(`Loaded settings for ${guilds.length} guild(s).`);

        // Fetch all guilds and their members, and ensure users are added to the database
        const guildsFetched = await client.guilds.fetch(); // Returns Collection<string, OAuth2Guild>

        // Explicitly handle OAuth2Guilds and fetch the full Guild object
        guildsFetched.forEach(async (oauthGuild: OAuth2Guild) => {
            try {
                // Fetch the full Guild object using the OAuth2Guild ID
                const guild = await client.guilds.fetch(oauthGuild.id);

                // Fetch guild members
                const members = await guild.members.fetch();
                members.forEach(async (member: GuildMember) => {
                    try {
                        await UserService.ensureUserExists(client, member);  // Pass client and member
                    } catch (error) {
                        Logger.error(`Error ensuring user exists in DB for member ${member.id}: ${error}`);
                    }
                });
            } catch (error) {
                Logger.error(`Error fetching full guild for ${oauthGuild.name}: ${error}`);
            }
        });

    } catch (error: unknown) {
        if (error instanceof Error) {
            Logger.error(`Error while connecting to the database or loading guild settings: ${error.message}`);
        } else {
            Logger.error(`Unknown error while loading guild settings: ${error}`);
        }
    }
});

// Log in using the bot token from the config
client.login(config.discord.botToken).catch((err) => {
    Logger.error(`Failed to log in: ${err.message}`);
});
