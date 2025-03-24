import CustomClient from './customClient';
import { Client, GatewayIntentBits, Collection, Guild, GuildMember, OAuth2Guild } from 'discord.js';
import fs from 'fs';
import Logger from './logger';
import Database from './database';
import UserService from './userService';
import { handleCommandExecution } from './loader';
import { GuildSettings } from './types';

// Load the configuration
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

// instance of the Discord client
const client = new CustomClient({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers],
});

// Add a guildSettings cache to the client
client.guildSettings = new Collection<string, GuildSettings>();

// When the client is ready (logged in)
client.once('ready', async () => {
    Logger.info(`Logged in as ${client.user?.tag}`);

    try {
        // Connect to the database
        await Database.connect();

        // Load guild settings from the database and set them in the cache
        const guilds = await Database.getAllGuilds();
        for (const guild of guilds) {
            client.guildSettings.set(guild.id, guild.settings as GuildSettings);
        };

        Logger.info(`Loaded settings for ${guilds.length} guild(s).`);

        // Fetch all guilds and their members, and ensure users are added to the database
        const guildsFetched = await client.guilds.fetch(); // Returns Collection<string, OAuth2Guild>

        // Explicitly handle OAuth2Guilds and fetch the full Guild object
        for (const oauthGuild of guildsFetched.values())    {
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
