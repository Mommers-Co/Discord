const { Client, GatewayIntentBits, Partials, Collection, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config.json');
const { addUserToDatabase, getUserByDiscordId, updateUserStatus } = require('../gateway/appwrite');
const { logEvent } = require('../shared/logger');
const { startServerStatusAlerts } = require('../shared/serverStatusAlerts');
const schedule = require('node-schedule');
const { runBackup } = require('../gateway/backup');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.GuildMessageReactions
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
    if (!interaction.isCommand()) return;

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
});

// Event: When a new member joins the guild
client.on('guildMemberAdd', async (member) => {
    LogEvent('New Member Joined', 'MemberEvent', { user: member.user.tag, userId: member.id });

    const sixHours = 6 * 60 * 60 * 1000;

    try {
        // Check if user exists in the database
        const existingUser = await getUserByDiscordId(member.id);
        if (existingUser) {
            await updateUserStatus(member.id, { lastActive: new Date().toISOString(), verifiedStatus: true });
            LogEvent('Existing User Updated', 'MemberEvent', { user: member.user.tag, userId: member.id });
        } else {
            await addUserToDatabase({
                discordUserId: member.id,
                username: member.user.tag,
                joinedAt: new Date().toISOString(),
                verifiedStatus: false,
                lastActive: new Date().toISOString(),
                roles: [],
                warnings: 0,
                bans: 0,
                notes: [],
                ticketIds: [],
                discordCreation: member.user.createdAt.toISOString(),
            });
            LogEvent('New User Added to Database', 'MemberEvent', { user: member.user.tag, userId: member.id });
        }

        const dmChannel = await member.createDM();
        LogEvent('DM Channel Created', 'MemberEvent', { user: member.user.tag, userId: member.id });

        // DM message to the new member
        const dmEmbed = new EmbedBuilder()
            .setColor('#D08770')
            .setTitle('Welcome to Our Server!')
            .setDescription('To verify your account, please react with ✅ to this message.')
            .setFooter({ text: 'Thank you for joining us!', iconURL: 'https://i.imgur.com/QmJkPOZ.png' });

        const verificationMessage = await dmChannel.send({ embeds: [dmEmbed] });
        await verificationMessage.react('✅');
        LogEvent('Verification DM Sent', 'MemberEvent', { user: member.user.tag, userId: member.id });

        const filter = (reaction, user) => reaction.emoji.name === '✅' && user.id === member.id;

        const collector = verificationMessage.createReactionCollector({ filter, time: 7 * 24 * 60 * 60 * 1000 });

        // Schedule first reminder after 6 hours
        schedule.scheduleJob(Date.now() + sixHours, async () => {
            if (!member.roles.cache.has(config.roles.memberRoleId)) {
                const reminderEmbed = new EmbedBuilder()
                    .setColor('#D08770')
                    .setTitle('Reminder: Verify Your Account')
                    .setDescription('Please verify your account by reacting with ✅ to the verification message. You have 6 hours left to complete the verification process.')
                    .setFooter({ text: 'Mommers Co', iconURL: 'https://i.imgur.com/QmJkPOZ.png' });

                await dmChannel.send({ embeds: [reminderEmbed] });
                LogEvent('1st Verification Reminder Sent', 'MemberEvent', { user: member.user.tag, userId: member.id });
            }
        });

        // Schedule final reminder 6 hours after the first reminder
        schedule.scheduleJob(Date.now() + 2 * sixHours, async () => {
            if (!member.roles.cache.has(config.roles.memberRoleId)) {
                const finalReminderEmbed = new EmbedBuilder()
                    .setColor('#D08770')
                    .setTitle('Final Reminder: Verify Your Account')
                    .setDescription('This is your final reminder to verify your account by reacting with ✅ to the verification message. Failure to do so will result in removal from the server.')
                    .setFooter({ text: 'Mommers Co', iconURL: 'https://i.imgur.com/QmJkPOZ.png' });

                await dmChannel.send({ embeds: [finalReminderEmbed] });
                LogEvent('2nd Verification Reminder Sent', 'MemberEvent', { user: member.user.tag, userId: member.id });
            }
        });

        // Schedule kick if no verification within 1 hour after final reminder
        schedule.scheduleJob(Date.now() + 3 * sixHours, async () => {
            if (!member.roles.cache.has(config.roles.memberRoleId)) {
                await member.kick('Verification not completed within the given time');
                LogEvent('Member Kicked for Non-Verification', 'MemberEvent', { user: member.user.tag, userId: member.id });

                const kickEmbed = new EmbedBuilder()
                    .setColor('#D08770')
                    .setTitle('Member Removed')
                    .setDescription(`${member.user.tag} was removed from the server due to failure to verify their account.`)
                    .setFooter({ text: `User ID: ${member.id}`, iconURL: 'https://i.imgur.com/QmJkPOZ.png' });

                await dmChannel.send({ embeds: [kickEmbed] });
            }
        });

        // Verification reaction collector event
        collector.on('collect', async () => {
            const role = member.guild.roles.cache.get(config.roles.memberRoleId);
            await member.roles.add(role);
            LogEvent('Member Verified', 'MemberEvent', { user: member.user.tag, userId: member.id });

            const verifiedEmbed = new EmbedBuilder()
                .setColor('#A3BE8C')
                .setTitle('Verification Complete')
                .setDescription('Thank you for verifying your account! You now have full access to the server.')
                .setFooter({ text: 'Mommers Co', iconURL: 'https://i.imgur.com/QmJkPOZ.png' });

            await dmChannel.send({ embeds: [verifiedEmbed] });

            // Send welcome message to the main entrance channel
            const welcomeChannel = member.guild.channels.cache.get(config.discord.channels.mainEntranceChannelId);
            if (welcomeChannel) {
                const welcomeEmbed = new EmbedBuilder()
                    .setColor('#A3BE8C')
                    .setTitle('Welcome to our Server!')
                    .setDescription(`We are glad to have you here <@${member.user.id}>!`)
                    .setFooter({ text: 'Mommers Co', iconURL: 'https://i.imgur.com/QmJkPOZ.png' });

                await welcomeChannel.send({ embeds: [welcomeEmbed] });
                LogEvent('Welcome Message Sent', 'MemberEvent', { user: member.user.tag, userId: member.id });
            } else {
                LogEvent('Welcome Message Failed', 'Error', { user: member.user.tag, userId: member.id, error: 'Channel not found' });
            }
        });

        // Collector ends
        collector.on('end', async () => {
            LogEvent('Verification Reaction Collector Ended', 'MemberEvent', { user: member.user.tag, userId: member.id });
        });

    } catch (error) {
        LogEvent('GuildMemberAdd Event Error', 'Error', { error: error.message, user: member.user.tag, userId: member.id });
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
