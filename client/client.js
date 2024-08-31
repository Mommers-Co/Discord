const { Client, GatewayIntentBits, Partials, Collection, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config.json');
const { addUserToDatabase, getUserByDiscordId, updateUserStatus, startDatabaseUpdater } = require('../gateway/appwrite');
const { logEvent } = require('../shared/logger');
const { startServerStatusAlerts } = require('../shared/serverStatusAlerts');
const schedule = require('node-schedule');
const { runBackup } = require('../gateway/backup');
const { setupAuditLogs } = require('./audit.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
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
});


setInterval(() => {
    runBackup(client);
    LogEvent('Backup started', 'Info');
}, config.discord.backupInterval);

// Event: Command interaction
client.on('interactionCreate', async (interaction) => {
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
            LogEvent('Command Not Found', 'Error', { commandName: interaction.commandName });
            return;
        }

        try {
            LogEvent('Command Executed', 'Info', {
                userId: interaction.user.id,
                username: interaction.user.tag,
                command: interaction.commandName,
                timestamp: new Date().toISOString()
            });

            await command.execute(interaction);
        } catch (error) {
            LogEvent('Command Execution Error', 'Error', { commandName: interaction.commandName, error: error.message });

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp('There was an error executing this command!');
            } else {
                await interaction.reply('There was an error executing this command!');
            }
        }
    }
});

// Event: When a new member joins the guild
client.on('guildMemberAdd', async (member) => {
    LogEvent('New Member Joined', 'MemberEvent', { user: member.user.tag, userId: member.id });

    const sixHours = 6 * 60 * 60 * 1000;

    try {
        // Check if user is already in the database
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
            LogEvent('User Added to Database', 'Info', { user: member.user.tag });
        }

        const welcomeChannel = member.guild.channels.cache.get(config.discord.welcomeChannelId);
        if (welcomeChannel) {
            await welcomeChannel.send(`Welcome to the server, ${member.user.tag}!`);
        }

        // Check if user was added recently
        if (new Date() - member.user.createdAt < sixHours) {
            await member.kick('Account was created less than 6 hours ago');
            LogEvent('User Kicked', 'Security', { user: member.user.tag, reason: 'Account created less than 6 hours ago' });
        }
    } catch (error) {
        LogEvent('Error Handling New Member', 'Error', { user: member.user.tag, error: error.message });
    }
});

// Event: When a member leaves the guild
client.on('guildMemberRemove', async (member) => {
    LogEvent('Member Left', 'MemberEvent', { user: member.user.tag, userId: member.id });

    // Farewell embed message
    const farewellEmbed = new EmbedBuilder()
        .setColor('#BF616A')
        .setTitle('Goodbye!')
        .setDescription(`${member.user.tag} has left the server. We wish them all the best!`)
        .setFooter({ text: `User ID: ${member.id}`, iconURL: config.serverLogo });

    const farewellChannel = member.guild.channels.cache.get(config.discord.channels.mainEntranceChannelId);
    LogEvent('User left the Server', 'MemberEvent', { user: member.user.tag, userId: member.id });
    
    // Check if the channel exists before sending the message
    if (farewellChannel) {
        await farewellChannel.send({ embeds: [farewellEmbed] });
        LogEvent('Farewell Message Sent', 'MemberEvent', { user: member.user.tag, userId: member.id });
    } else {
        LogEvent('Farewell Message Failed', 'Error', { user: member.user.tag, userId: member.id, error: 'Channel not found' });
    }

    // Update user status in Appwrite
    try {
        await updateUserStatus(member.id, { lastActive: new Date().toISOString(), verifiedStatus: false });
        LogEvent('User Status Updated in Database', 'MemberEvent', { user: member.user.tag, userId: member.id });
    } catch (error) {
        LogEvent('Database Update Error', 'Error', { userId: member.id, username: member.user.tag, error: error.message });
    }
});

// Log in the Discord client
client.login(config.discord.botToken)
    .then(() => LogEvent('Bot Login Successful', 'Info'))
    .catch(error => LogEvent('Bot Login Error', 'Error', { message: error.message }));
