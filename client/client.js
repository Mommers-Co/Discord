const { Client, GatewayIntentBits, Partials, Collection, REST, Routes, EmbedBuilder, ActivityType } = require('discord.js');
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

    // Update the bot activity to reflect member count
    const guild = client.guilds.cache.get(config.discord.guildId);
    if (guild) {
        const memberCount = guild.memberCount;
        try {
            await client.user.setActivity(`${memberCount} Members`, { type: ActivityType.Watching });
            LogEvent('Bot Activity Updated', 'Info', { activity: `Watching ${memberCount} Members` });
        } catch (error) {
            LogEvent('Bot Activity Update Error', 'Error', { message: error.message });
        }
    }
});

// Scheduled backup task
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

client.on('guildMemberAdd', async (member) => {
    LogEvent('New Member Joined', 'MemberEvent', { user: member.user.tag, userId: member.id });

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
        } else if (user.verifiedStatus) {
            // User is already verified
            const welcomeChannel = member.guild.channels.cache.get(config.discord.channels.mainEntranceChannelId);
            if (welcomeChannel) {
                const welcomeEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('Welcome Back!')
                    .setDescription(`Welcome back, ${member.user.tag}! We're glad to see you again.`)
                    .setThumbnail(member.user.displayAvatarURL())
                    .setTimestamp();
                
                await welcomeChannel.send({ embeds: [welcomeEmbed] });
                LogEvent('Welcome Back Message Sent', 'Info', { user: member.user.tag });
            }
            return; // Exit the function if the user is already verified
        }

        // Send the verification message to the user as an embed
        const dmChannel = await member.createDM();
        const verificationEmbed = new EmbedBuilder()
            .setColor('#FFCC00')
            .setTitle('Verification Required')
            .setDescription(`Welcome to the server, ${member.user.tag}! Please react with ✅ to verify your account.`)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        const verificationMessage = await dmChannel.send({ embeds: [verificationEmbed] });

        LogEvent('Verification Embed Sent to DM', 'Info', { user: member.user.tag });

        // React to the message to trigger user verification
        await verificationMessage.react('✅');

        // Create a reaction collector for the verification message
        const filter = (reaction, user) => {
            return reaction.emoji.name === '✅' && user.id === member.id;
        };

        const collector = verificationMessage.createReactionCollector({ filter, time: 15 * 60 * 1000 }); // 15 minutes to verify

        collector.on('collect', async (reaction, user) => {
            LogEvent('Verification Reaction Collected', 'Info', { user: member.user.tag });

            const verifiedRole = member.guild.roles.cache.get(config.discord.roles.memberRoleId);
            if (verifiedRole) {
                await member.roles.add(verifiedRole);
                await updateUserStatus(member.id, { verifiedStatus: true, verificationDate: new Date().toISOString() });
                LogEvent('User Verified', 'Info', { user: member.user.tag });

                // Notify the user of successful verification
                await member.send(`Thank you for verifying your account, ${member.user.tag}! You now have access to the server.`);

                // Send a welcome message to the main entrance channel
                const welcomeChannel = member.guild.channels.cache.get(config.discord.channels.mainEntranceChannelId);
                if (welcomeChannel) {
                    const welcomeEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('Welcome!')
                        .setDescription(`Hello, ${member.user.tag}! Welcome to our server! We're excited to have you here.`)
                        .setThumbnail(member.user.displayAvatarURL())
                        .setTimestamp();
                    
                    await welcomeChannel.send({ embeds: [welcomeEmbed] });
                    LogEvent('Welcome Message Sent to Main Entrance Channel', 'Info', { user: member.user.tag });
                }
            } else {
                LogEvent('Verified Role Not Found', 'Error', { user: member.user.tag });
            }

            collector.stop(); // Stop collecting after successful verification
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                LogEvent('Verification Timed Out', 'Info', { user: member.user.tag });
                member.send('Verification timed out. Please try again by reacting to the verification message.');
            }
        });
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
    
    // Remove their roles and update their status in the database
    try {
        await updateUserStatus(member.id, { verifiedStatus: false });
        LogEvent('User Status Updated to Unverified', 'Info', { user: member.user.tag });
    } catch (error) {
        LogEvent('User Status Update Error', 'Error', { user: member.user.tag, error: error.message });
    }

    if (farewellChannel) {
        farewellChannel.send({ embeds: [farewellEmbed] });
    }
});

// Log in the Discord client
client.login(config.discord.botToken)
    .then(() => LogEvent('Bot Login Successful', 'Info'))
    .catch(error => LogEvent('Bot Login Error', 'Error', { message: error.message }));
