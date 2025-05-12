import CustomClient from './customClient';
import { GatewayIntentBits, ActivityType, Collection, Client, GuildMember, PartialGuildMember, Partials } from 'discord.js';
import fs from 'fs';
import Logger from './logger';
import Database from './database';
import UserService from './userService';
import { GuildSettings } from './types';
import { handleNewMemberJoin, handleMemberLeave } from './auth';

// Load the configuration (with guild settings from config.json)
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

// Instance of the Discord client
const client = new CustomClient({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Add a guildSettings cache to the client (this should work now, since we extended CustomClient)
client.guildSettings = new Collection<string, any>(); // Using 'any' to hold dynamic guild settings

// When the client is ready (logged in)
client.once('ready', async () => {
    Logger.info(`Logged in as ${client.user?.tag}`);

    try {
        // Connect to the database
        Logger.info('Attempting to connect to the database...');
        await Database.connect();
        Logger.info('Database connection established.');

        // Load guild settings from config.json and set them in the cache
        Logger.info('Loading guild settings from config...');
        for (const guildId in config.discord) {
            const guildConfig = config.discord[guildId];

            // Only add guilds that have settings defined in config.json
            if (guildConfig.guildId) {
                client.guildSettings.set(guildId, guildConfig);
                Logger.info(`Guild settings loaded into cache for guild ID: ${guildId}`);
            } else {
                Logger.warn(`Guild config for key "${guildId}" is missing a guildId.`);
            }
        }

        Logger.info(`Successfully loaded settings for ${client.guildSettings.size} guild(s).`);

        // Log the loaded guild settings for debugging
        client.guildSettings.forEach((guildConfig, guildId) => {
            Logger.info(`Config for guild ${guildId}: ${JSON.stringify(guildConfig, null, 2)}`);
        });

        // Fetch all guilds and their members, and ensure users are added to the database
        Logger.info('Fetching all connected guilds...');
        const guildsFetched = await client.guilds.fetch();

        Logger.info(`Fetched ${guildsFetched.size} guild(s) from Discord.`);

        for (const oauthGuild of guildsFetched.values()) {
            try {
                Logger.info(`Fetching full guild object for: ${oauthGuild.name} (${oauthGuild.id})`);
                const guild = await client.guilds.fetch(oauthGuild.id);

                Logger.info(`Fetching members for guild: ${guild.name}`);
                const members = await guild.members.fetch();
                Logger.info(`Fetched ${members.size} members for guild: ${guild.name}`);

                for (const member of members.values()) {
                    try {
                        Logger.info(`Ensuring user exists in DB: ${member.user.tag} (${member.id})`);
                        await UserService.ensureUserExists(client, member);
                        Logger.info(`User confirmed/added: ${member.user.tag} (${member.id})`);
                    } catch (error) {
                        Logger.error(`Error ensuring user ${member.id} exists in DB : ${error}`);
                    }
                }
            } catch (error) {
                Logger.error(`Error fetching full guild for ${oauthGuild.name} (${oauthGuild.id}): ${error}`);
            }
        }

        // Update presence for each guild dynamically
        Logger.info('Updating bot presence...');
        updatePresence(client);
        Logger.info('Presence update complete.');

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

client.on('guildMemberAdd', async (member: GuildMember | PartialGuildMember) => {
    if (member instanceof GuildMember) {
        await handleNewMemberJoin(client, member);
    } else {
        // Fetch the full GuildMember if it's a PartialGuildMember
        const fullMember = await member.guild.members.fetch(member.id);
        await handleNewMemberJoin(client, fullMember);
    }
});

client.on('guildMemberRemove', async (member: GuildMember | PartialGuildMember) => {
    if (member instanceof GuildMember) {
        await handleMemberLeave(client, member);
    } else {
        // Fetch the full GuildMember if it's a PartialGuildMember
        const fullMember = await member.guild.members.fetch(member.id);
        await handleMemberLeave(client, fullMember);
    }
});

// Log in using the bot token from the config
client.login(config.discord.botToken).catch((err) => {
    Logger.error(`Failed to log in: ${err.message}`);
});
