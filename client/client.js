const { Client, GatewayIntentBits, Partials, Collection, REST, Routes, EmbedBuilder, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config.json');
const { addUserToDatabase, getUserByDiscordId, updateUserStatus, startDatabaseUpdater } = require('../gateway/appwrite');
const { logEvent } = require('../shared/logger');
const { startServerStatusAlerts } = require('../shared/serverStatusAlerts');
const schedule = require('node-schedule');
const { runBackup } = require('../gateway/backup');
const setupAuditLogs = require('./audit');


const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.GuildPresences
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

client.commands = new Collection();

// Helper function to log events with console fallback
const LogEvent = async (eventType, eventCategory, eventData) => {
    try {
        await logEvent(eventType, eventCategory, eventData);
    } catch (error) {
        console.error(`Failed to log event: ${eventType} - Error: ${error.message}`);
    }
};

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if (!command.data || !command.data.name) {
        LogEvent('Command Loading Error', 'Error', { filePath, message: "Command is missing 'data.name' property." });
        continue;
    }

    client.commands.set(command.data.name, command);
    LogEvent('Command Loaded', 'Info', { commandName: command.data.name, filePath });
}

// Event: When the client is ready
client.once('ready', async () => {
    const message = `Client: ${client.user.tag} is online!`;
    LogEvent('Bot Online', 'Info', { message });

    // Start server status alerts
    startServerStatusAlerts(client);
    LogEvent('Server Status Alerts Started', 'Info');

    // Start database updater
    startDatabaseUpdater(client);
    LogEvent('Database Updater Started', 'Info');

    // Setup audit logs monitoring
    setupAuditLogs(client);
    LogEvent('Audit Logs Started', 'Info');

    // Register slash commands with Discord API
    const rest = new REST({ version: '10' }).setToken(config.discord.botToken);
    const commands = client.commands.map(cmd => cmd.data.toJSON());

    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        LogEvent('Application Commands Registered', 'Info');
    } catch (error) {
        LogEvent('Application Commands Registration Error', 'Error', { message: error.message });
    }

    // Function to update bot activity
    async function updateActivity() {
    const guildConfigs = [config.discord.MCOGuild, config.discord.MCOLOGGuild];
    let index = 0;

        // Update activity every 60 seconds
        setInterval(async () => {
            const guildConfig = guildConfigs[index];
            const guild = client.guilds.cache.get(guildConfig.guildId);

            if (guild) {
                const memberCount = guild.memberCount;
                try {
                    await client.user.setActivity(`${memberCount} Members in ${guild.name}`, { type: ActivityType.Watching });
                    LogEvent('Bot Activity Updated', 'Info', { guild: guild.name, activity: `Watching ${memberCount} Members` });
                } catch (error) {
                    LogEvent('Bot Activity Update Error', 'Error', { guild: guild.name, message: error.message });
                }
            } else {
                LogEvent('Bot Activity Update Error', 'Error', { guild: guildConfig.guildId, message: 'Guild not found' });
            }

            // Switch to the next guild config
            index = (index + 1) % guildConfigs.length;
        }, 60000); // 60 seconds
    }

    // Call the function to start updating activity
    updateActivity();
});

// Scheduled backup task
schedule.scheduleJob(config.discord.backupInterval, () => {
    runBackup(client);
    LogEvent('Backup started', 'Info');
});

// Event: Command interaction
client.on('interactionCreate', async (interaction) => {
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
            LogEvent('Command Not Found', 'Error', { commandName: interaction.commandName, guild: interaction.guild?.name });
            return;
        }

        try {
            LogEvent('Command Executed', 'Info', {
                userId: interaction.user.id,
                username: interaction.user.tag,
                command: interaction.commandName,
                guild: interaction.guild?.name,
                timestamp: new Date().toISOString()
            });

            await command.execute(interaction);
        } catch (error) {
            LogEvent('Command Execution Error', 'Error', { commandName: interaction.commandName, error: error.message, guild: interaction.guild?.name });

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp('There was an error executing this command!');
            } else {
                await interaction.reply('There was an error executing this command!');
            }
        }
    }
});

// Handle when a new member joins any guild
client.on('guildMemberAdd', async (member) => {
    LogEvent('New Member Joined', 'MemberEvent', { user: member.user.tag, userId: member.id, guild: member.guild.name });

    try {
        const user = await getUserByDiscordId(member.id);

        if (!user) {
            const newUser = {
                discordUserId: member.id,
                username: member.user.tag,
                JoinedAt: new Date().toISOString(),
                verifiedStatus: false,
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

            await addUserToDatabase(newUser);
            LogEvent('User Added to Database', 'Info', { user: member.user.tag, guild: member.guild.name });
        }

        // Welcome message embed
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle(`Welcome to ${member.guild.name}, ${member.user.tag}!`)
            .setDescription('We are glad to have you here! Please check the rules and verify your account.')
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        const welcomeChannel = member.guild.channels.cache.get(config.discord.MCOGuild.channels.welcomeChannelId);
        if (welcomeChannel) {
            await welcomeChannel.send({ embeds: [welcomeEmbed] });
        }

        const dmChannel = await member.createDM();
        const verificationEmbed = new EmbedBuilder()
            .setColor('#FFCC00')
            .setTitle('Verification Required')
            .setDescription(`Welcome to the server, ${member.user.tag}! Please react with ✅ to verify your account.`)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        const verificationMessage = await dmChannel.send({ embeds: [verificationEmbed] });

        LogEvent('Verification Embed Sent to DM', 'Info', { user: member.user.tag, guild: member.guild.name });

        await verificationMessage.react('✅');
        const filter = (reaction, user) => reaction.emoji.name === '✅' && user.id === member.id;

        const collector = verificationMessage.createReactionCollector({ filter, time: 15 * 60 * 1000 });

        collector.on('collect', async () => {
            LogEvent('Verification Reaction Collected', 'Info', { user: member.user.tag, guild: member.guild.name });

            const verifiedRole = member.guild.roles.cache.get(config.discord.MCOGuild.roles.memberRoleId);
            if (verifiedRole) {
                await member.roles.add(verifiedRole);
                await updateUserStatus(member.id, { verifiedStatus: true, verificationDate: new Date().toISOString() });
                LogEvent('User Verified', 'Info', { user: member.user.tag, guild: member.guild.name });

                await member.send(`Thank you for verifying your account, ${member.user.tag}! You now have access to the server.`);
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                LogEvent('Verification Timed Out', 'Info', { user: member.user.tag, guild: member.guild.name });
                member.send('Verification timed out. Please try again by reacting to the verification message.');
            }
        });
    } catch (error) {
        LogEvent('Error Handling New Member', 'Error', { user: member.user.tag, guild: member.guild.name, error: error.message });
    }
});

// Handle when a member leaves any guild
client.on('guildMemberRemove', async (member) => {
    LogEvent('Member Left', 'MemberEvent', { user: member.user.tag, userId: member.id, guild: member.guild.name });

    try {
        await updateUserStatus(member.id, { verifiedStatus: false });
        LogEvent('User Status Updated to Unverified', 'Info', { user: member.user.tag, guild: member.guild.name });

        // Leave message embed
        const leaveEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle(`${member.user.tag} has left ${member.guild.name}.`)
            .setTimestamp();

        const leaveChannel = member.guild.channels.cache.get(config.discord.MCOGuild.channels.leaveChannelId);
        if (leaveChannel) {
            await leaveChannel.send({ embeds: [leaveEmbed] });
        }
    } catch (error) {
        LogEvent('Error Handling Member Leave', 'Error', { user: member.user.tag, guild: member.guild.name, error: error.message });
    }
});

// Log in to Discord with the bot token
client.login(config.discord.botToken).catch(error => LogEvent('Bot Login Failed', 'Error', { error: error.message }));