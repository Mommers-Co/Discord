const { Client, GatewayIntentBits, Partials, Collection, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config.json');
const { addUserToDatabase, getUserByDiscordId, updateUserStatus, getAppwriteClient } = require('../gateway/appwrite');
const { logEvent } = require('../shared/logger');
const { startServerStatusAlerts } = require('../shared/serverStatusAlerts');
const schedule = require('node-schedule');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction] // Ensure partials are included for messages and reactions
});

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    console.log(`Loaded command from ${filePath}:`, command);

    if (!command.data || !command.data.name) {
        console.error(`Command in ${filePath} is missing 'data.name' property.`);
        continue;
    }

    client.commands.set(command.data.name, command);
}

// Event: When the client is ready
client.once('ready', () => {
    const message = `Client: ${client.user.tag} is online!`;
    console.log(message);
    logEvent('Bot is online!', message);

    // Start server status alerts
    startServerStatusAlerts(client);

    // Register slash commands with Discord API
    const rest = new REST({ version: '10' }).setToken(config.discord.botToken);

    const commands = client.commands.map(cmd => cmd.data.toJSON());

    (async () => {
        try {
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands },
            );
            console.log('Successfully registered application commands.');
        } catch (error) {
            console.error('Error registering application commands:', error);
        }
    })();
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`Command ${interaction.commandName} not found`);
        return;
    }

    try {
        // Log command usage
        logEvent('Command Used', 'CommandExecution', {
            userId: interaction.user.id,
            username: interaction.user.tag,
            command: interaction.commandName,
            timestamp: new Date().toISOString()
        });

        await command.execute(interaction);
        console.log(`Executed command: ${interaction.commandName}`);
    } catch (error) {
        console.error('Error executing command:', error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp('There was an error executing this command!');
        } else {
            await interaction.reply('There was an error executing this command!');
        }
    }
});

// Event: When a new member joins the guild
client.on('guildMemberAdd', async (member) => {
    logEvent('New member joined', 'MemberEvent', { user: member.user.tag });

    let verificationMessage;
    const sixHours = 6 * 60 * 60 * 1000; // 6 hours
    const finalReminderInterval = 1 * 60 * 60 * 1000; // 1 hour

    try {
        const dmChannel = await member.createDM();
        logEvent('DM Channel Created', 'MemberEvent', { user: member.user.tag });

        // DM message to the new member
        const dmEmbed = new EmbedBuilder()
            .setColor('#D08770')
            .setTitle('Welcome to Our Server!')
            .setDescription('To verify your account, please react with ✅ to this message.')
            .setFooter({ text: 'Thank you for joining us!', iconURL: 'https://i.imgur.com/QmJkPOZ.png' });

        verificationMessage = await dmChannel.send({ embeds: [dmEmbed] });
        await verificationMessage.react('✅'); // React with the verification emoji
        logEvent('Verification DM Sent', 'MemberEvent', { user: member.user.tag });

        const filter = (reaction, user) => {
            return reaction.emoji.name === '✅' && user.id === member.id;
        };

        const collector = verificationMessage.createReactionCollector({ filter, time: 7 * 24 * 60 * 60 * 1000 }); // 7 days

        // Schedule first reminder after 6 hours
        const firstReminder = schedule.scheduleJob(Date.now() + sixHours, async () => {
            if (!member.roles.cache.has(config.roles.memberRoleId)) {
                const reminderEmbed = new EmbedBuilder()
                    .setColor('#D08770')
                    .setTitle('Reminder: Verify Your Account')
                    .setDescription(`Please verify your account by reacting with ✅ to the verification message. You have 6 hours left to complete the verification process.`)
                    .setFooter({ text: 'Mommers Co', iconURL: 'https://i.imgur.com/QmJkPOZ.png' });

                await dmChannel.send({ embeds: [reminderEmbed] });
                logEvent('1st Verification Reminder Sent', 'MemberEvent', { user: member.user.tag });
            }
        });

        // Schedule final reminder 6 hours after the first reminder
        const finalReminder = schedule.scheduleJob(Date.now() + 2 * sixHours, async () => {
            if (!member.roles.cache.has(config.roles.memberRoleId)) {
                const finalReminderEmbed = new EmbedBuilder()
                    .setColor('#D08770')
                    .setTitle('Final Reminder: Verify Your Account')
                    .setDescription('This is your final reminder to verify your account by reacting with ✅ to the verification message. Failure to do so will result in removal from the server.')
                    .setFooter({ text: 'Mommers Co', iconURL: 'https://i.imgur.com/QmJkPOZ.png' });

                await dmChannel.send({ embeds: [finalReminderEmbed] });
                logEvent('2nd Verification Reminder Sent', 'MemberEvent', { user: member.user.tag });
            }
        });

        // Schedule kick if no verification within 1 hour after final reminder
        schedule.scheduleJob(Date.now() + 3 * sixHours, async () => {
            if (!member.roles.cache.has(config.roles.memberRoleId)) {
                await member.kick('Verification not completed within the given time');
                logEvent('Member kicked due to non-verification', 'MemberEvent', { user: member.user.tag });

                const kickEmbed = new EmbedBuilder()
                    .setColor('#D08770')
                    .setTitle('Member Removed')
                    .setDescription(`${member.user.tag} was removed from the server due to failure to verify their account.`)
                    .setFooter({ text: `User ID: ${member.id}`, iconURL: 'https://i.imgur.com/QmJkPOZ.png' });

                const leaveChannel = await client.channels.fetch(config.channels.mainEntranceChannelId);
                if (leaveChannel) {
                    await leaveChannel.send({ embeds: [kickEmbed] });
                }
            }
        });

        collector.on('collect', async (reaction, user) => {
            if (user.id !== member.id) return;
            
            logEvent('Verification DM Verified', 'MemberEvent', { user: member.user.tag });

            // Verification successful
            try {
                const existingUser = await getUserByDiscordId(member.id);
                if (existingUser) {
                    // Update existing user's status and last action
                    await updateUserStatus(member.id, {
                        verifiedStatus: true,
                        lastActive: new Date().toISOString(),
                        lastAction: 'Rejoined the server'
                    });
                    logEvent('User rejoined and status updated', 'MemberEvent', { user: member.user.tag });
                } else {
                    // Add new user to the database
                    await addUserToDatabase({
                        discordUserId: member.id,
                        username: member.user.tag,
                        JoinedAt: new Date().toISOString(),
                        verifiedStatus: true,
                        verificationDate: new Date().toISOString(),
                        lastActive: new Date().toISOString(),
                        roles: member.roles.cache.map(role => role.id),
                        warnings: 0,
                        bans: 0,
                        lastAction: null,
                        notes: '',
                        ticketIds: [],
                        discordCreation: member.user.createdAt.toISOString(),
                    });
                    logEvent('New user added to database', 'MemberEvent', { user: member.user.tag });
                }

                // Ensure the member role is added
                if (!member.roles.cache.has(config.roles.memberRoleId)) {
                    await member.roles.add(config.roles.memberRoleId);
                    logEvent('Member verified and role added', 'MemberEvent', { user: member.user.tag });

                    // Send a thank you message in the welcome channel
                    const welcomeChannelId = config.channels.mainEntranceChannelId;

                    if (!welcomeChannelId) {
                        throw new Error('Welcome channel ID is not defined in config.json.');
                    }

                    const welcomeChannel = await client.channels.fetch(welcomeChannelId);

                    if (welcomeChannel) {
                        const joinTimestamp = new Date().toLocaleString();

                        const welcomeEmbed = new EmbedBuilder()
                            .setColor('#D08770')
                            .setTitle('Welcome to Our Server!')
                            .setDescription(`<@${member.id}>, you've been granted access to the server!`)
                            .setFooter({ text: `User ID: ${member.id} | Timestamp: ${joinTimestamp}`, iconURL: 'https://i.imgur.com/QmJkPOZ.png' });

                        await welcomeChannel.send({ embeds: [welcomeEmbed] });
                    } else {
                        console.error(`[${new Date().toLocaleString()}] Welcome channel ${welcomeChannelId} not found.`);
                        logEvent('DiscordError', 'Welcome channel not found', welcomeChannelId);
                    }
                }

                // Stop the collector and cancel all scheduled jobs
                collector.stop('verified');
                firstReminder.cancel();
                finalReminder.cancel();
            } catch (error) {
                logEvent('Error adding or updating user in Appwrite', 'Error', error.message);
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason !== 'verified') {
                await member.kick('Verification not completed');
                logEvent('Member kicked due to non-verification', 'MemberEvent', { user: member.user.tag });
            }
        });

    } catch (error) {
        logEvent('Error handling new member', 'Error', error.message);
    }
});

// Event: When a member leaves the guild
client.on('guildMemberRemove', async (member) => {
    const leaveTimestamp = new Date().toLocaleString();
    logEvent('Member left', 'MemberEvent', { user: member.user.tag, userId: member.id, timestamp: leaveTimestamp });
    
    try {
        const leaveChannelId = config.channels.mainEntranceChannelId;

        if (!leaveChannelId) {
            throw new Error('Leave channel ID is not defined in config.json.');
        }

        const leaveChannel = await client.channels.fetch(leaveChannelId);

        if (leaveChannel) {
            const leaveEmbed = new EmbedBuilder()
                .setColor('#D08770')
                .setTitle('Member Left')
                .setDescription(`${member.user.tag} left the server.`)
                .setThumbnail(member.user.displayAvatarURL())
                .setFooter({ text: `User ID: ${member.id} | Timestamp: ${leaveTimestamp}`, iconURL: 'https://i.imgur.com/QmJkPOZ.png' });

            if (!member.roles.cache.has(config.roles.memberRoleId)) {
                leaveEmbed.setDescription(`${member.user.tag} left the server due to non-verification.`);
            }

            await leaveChannel.send({ embeds: [leaveEmbed] });
        } else {
            console.error(`[${new Date().toLocaleString()}] Leave channel ${leaveChannelId} not found.`);
            logEvent('DiscordError', 'Leave channel not found', leaveChannelId);
        }
    } catch (error) {
        logEvent('Error handling member leave', 'Error', error.message);
    }
});

client.login(config.discord.botToken).catch(error => {
    logEvent('Failed to login', 'Error', error.message);
});
