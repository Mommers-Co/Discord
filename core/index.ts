import CustomClient from './customClient';
import { GatewayIntentBits, ActivityType, Collection, GuildMember, PartialGuildMember, Partials } from 'discord.js';
import fs from 'fs';
import Logger from './logger';
import Database from './database';
import UserService from './userService';
import { GuildSettings } from './types';
import { handleNewMemberJoin, handleMemberLeave } from './auth';

// Load config with all guilds' settings
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

// Create instance of CustomClient
const client = new CustomClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Properly type guildSettings cache
client.guildSettings = new Collection<string, GuildSettings>();

// On client ready
client.once('ready', async () => {
    Logger.setClient(client);
    console.log('Loaded Discord config guild IDs:', Object.keys(config.discord.guilds));
    Logger.info(`Known guild IDs in config: ${Object.keys(config.discord.guilds).join(', ')}`);

    Logger.setGuildLogChannels(client.guildSettings);

    Logger.info(`Logged in as ${client.user?.tag}`);

    try {
        Logger.info('Connecting to the database...');
        await Database.connect();
        Logger.info('Database connection established.');

        Logger.info('Loading guild settings from config...');
        for (const key in config.discord.guilds) {
            const settings = config.discord.guilds[key];
            if (settings.guildId) {
                client.guildSettings.set(settings.guildId, settings);
                Logger.info(`Loaded settings for guild: ${settings.guildName || settings.guildId}`);
            } else {
                Logger.warn(`Guild config entry "${key}" is missing guildId.`);
            }
        }

        Logger.info(`Loaded settings for ${client.guildSettings.size} guild(s).`);

        client.guildSettings.forEach((cfg, id) => {
            Logger.info(`Guild ${id} config: ${JSON.stringify(cfg, null, 2)}`);
        });

        Logger.info('Fetching connected guilds...');
        const guildsFetched = await client.guilds.fetch();

        for (const oauthGuild of guildsFetched.values()) {
            try {
                const guild = await client.guilds.fetch(oauthGuild.id);
                const members = await guild.members.fetch();
                Logger.info(`Fetched ${members.size} members for guild: ${guild.name}`);

                for (const member of members.values()) {
                    try {
                        await UserService.ensureUserExists(client, member);
                        Logger.info(`Synced user: ${member.user.tag}`);
                    } catch (userErr) {
                        Logger.error(`User DB sync failed for ${member.user.tag}: ${userErr}`);
                    }
                }
            } catch (guildErr) {
                Logger.error(`Failed to fetch members for guild ${oauthGuild.name} (${oauthGuild.id}): ${guildErr}`);
            }
        }

        Logger.info('Starting presence rotation...');
        rotatePresence(client);
    } catch (startupErr) {
        Logger.error(`Startup error: ${startupErr instanceof Error ? startupErr.message : startupErr}`);
    }
});

// Rotates bot presence message every 60 seconds
const rotatePresence = async (client: CustomClient) => {
    const guilds = client.guilds.cache.map(g => g);
    let current = 0;

    const update = async () => {
        if (!guilds.length) return;

        const guild = guilds[current];
        current = (current + 1) % guilds.length;

        try {
            const members = await guild.members.fetch();
            const memberCount = members.filter(m => !m.user.bot).size;
            const settings = client.guildSettings.get(guild.id);
            const guildName = settings?.guildName || guild.name;

            await client.user?.setPresence({
                activities: [{
                    name: `${memberCount} Members in ${guildName}`,
                    type: ActivityType.Watching,
                }],
                status: 'online',
            });

            Logger.info(`Presence updated: Watching ${memberCount} Members in ${guildName}`);
        } catch (presenceErr) {
            Logger.warn(`Presence update failed for guild ${guild.name}: ${presenceErr}`);
        }
    };

    await update();
    setInterval(update, 60000);
};

// Member join handler
client.on('guildMemberAdd', async (member: GuildMember | PartialGuildMember) => {
    try {
        const fullMember = member instanceof GuildMember ? member : await member.guild.members.fetch(member.id);
        await handleNewMemberJoin(client, fullMember);
    } catch (err) {
        Logger.error(`Error handling guildMemberAdd: ${err}`);
    }
});

// Member leave handler
client.on('guildMemberRemove', async (member: GuildMember | PartialGuildMember) => {
    try {
        // Fetch full member for leave handler (since it expects GuildMember)
        // If member.guild is undefined (rare edge case), handle gracefully
        if ('guild' in member && member.guild) {
            const fullMember = member instanceof GuildMember ? member : await member.guild.members.fetch(member.id);
            await handleMemberLeave(client, fullMember);
        } else {
            Logger.warn('guildMemberRemove event received a member without guild, skipping leave handler.');
        }
    } catch (err) {
        Logger.error(`Error handling guildMemberRemove: ${err}`);
    }
});

// Bot login
client.login(config.discord.botToken).catch((err) => {
    Logger.error(`Bot login failed: ${err.message}`);
});
