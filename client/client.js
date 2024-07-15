// client/client.js
const { Client, MessageEmbed, GatewayIntentBits, Partials } = require('discord.js');
const config = require('../config.json');
const { initializeAppwriteClient, getAppwriteClient } = require('../gateway/appwrite');
const { logEvent, handleClientError } = require('../shared/logger');

const RoleID = config.roles.memberId;
const WelcomeChannelID = config.channels.welcomeChannelId;
const KickDaysThreshold = 10;
const ReminderDaysThreshold = 7;

console.log('Starting bot...');

// Initialize and start the Discord bot
async function startBotClient() {
    let botClient;

    try {
        // Initialize Discord bot client
        botClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages // Include all necessary intents
            ],
            partials: [Partials.MESSAGE, Partials.CHANNEL, Partials.REACTION, Partials.GUILD_MEMBER, Partials.USER],
            allowedMentions: { parse: ['users', 'roles'], repliedUser: true }
        });

        // Login to Discord with bot token
        await botClient.login(config.discord.botToken);
        logEvent('Bot', 'Login', `Logged in ${botClient.user.tag}`);
        console.log(`Logged in as ${botClient.user.tag}`);

        // Initialize Appwrite client
        await initializeAppwriteClient();
        logEvent('Appwrite', 'Initialize', 'Appwrite client initialized');

        // Event: When the bot is ready
        botClient.once('ready', () => {
            console.log(`Bot is ready ${botClient.user.tag}!`);
            logEvent('Bot', 'Ready', `Bot ready ${botClient.user.tag}`);

            // Periodic check for unverified members
            setInterval(checkUnverifiedMembers, 86400000);
        });

        // Event: When a member joins the server
        botClient.on('guildMemberAdd', async (member) => {
            try {
                const joinedAt = member.joinedAt;
                const welcomeChannel = await botClient.channels.fetch(WelcomeChannelID);
                if (welcomeChannel && welcomeChannel.isText()) {
                    const welcomeMessage = new MessageEmbed()
                        .setColor('#0099ff')
                        .setTitle(`Welcome to the server, ${member.user.username}!`)
                        .setDescription(`Your account was created in ${joinedAt.getFullYear()}. Please react with ✅ to verify yourself.`);

                    const welcomeMsg = await welcomeChannel.send({ embeds: [welcomeMessage] });

                    await welcomeMsg.react('✅');

                    const filter = (reaction, user) => reaction.emoji.name === '✅' && user.id === member.user.id;
                    const collector = welcomeMsg.createReactionCollector({ filter, time: 60000 });

                    collector.on('collect', async () => {
                        const memberRole = member.guild.roles.cache.find(role => role.id === RoleID);
                        if (memberRole) {
                            await member.roles.add(memberRole);
                            logEvent('Verification', 'RoleAdded', `Added role ${memberRole.name} to ${member.user.tag}`);
                        }
                    });

                    collector.on('end', collected => {
                        if (collected.size === 0) {
                            logEvent('Verification', 'Timeout', `Verification timeout for ${member.user.tag}`);
                        }
                    });
                } else {
                    console.error(`Welcome channel ${WelcomeChannelID} not found or not a text channel.`);
                }
            } catch (error) {
                console.error('Error handling guildMemberAdd event:', error);
                handleClientError('Bot', 'GuildMemberAddError', `Error handling guildMemberAdd event for ${member.user.tag}`, error);
            }
        });

        // Event: When a member leaves the server
        botClient.on('guildMemberRemove', async (member) => {
            try {
                const appwrite = getAppwriteClient();
                const usersCollection = appwrite.database.collection(config.appwrite.discordDatabase.usersCollectionId);

                // Update Appwrite database to mark user as inactive or left
                const result = await usersCollection.updateDocument(member.id, {
                    active: false,
                    lastAction: 'Left the server',
                    leftAt: new Date().toISOString()
                });

                logEvent('Member', 'Remove', `User ${member.user.tag} updated in Appwrite: ${JSON.stringify(result)}`);
            } catch (error) {
                console.error('Error updating user in Appwrite on guildMemberRemove:', error);
                handleClientError('Bot', 'GuildMemberRemoveError', `Error updating user ${member.user.tag} in Appwrite`, error);
            }
        });

        // Event: When a member rejoins the server
        botClient.on('guildMemberAdd', async (member) => {
            try {
                const appwrite = getAppwriteClient();
                const usersCollection = appwrite.database.collection(config.appwrite.discordDatabase.usersCollectionId);

                // Check if user already exists in Appwrite, update if exists, create new if not
                const existingUser = await usersCollection.getDocument(member.id);

                if (existingUser) {
                    // User already exists, update their record
                    const result = await usersCollection.updateDocument(member.id, {
                        active: true,
                        lastAction: 'Rejoined the server',
                        rejoinedAt: new Date().toISOString()
                    });

                    logEvent('Member', 'Rejoin', `User ${member.user.tag} rejoined and updated in Appwrite: ${JSON.stringify(result)}`);
                } else {
                    // User doesn't exist, create a new record
                    const result = await usersCollection.createDocument({
                        $id: member.id,
                        discordUserId: member.id,
                        username: member.user.username,
                        active: true,
                        joinedAt: new Date().toISOString(),
                        lastAction: 'Joined the server'
                    });

                    logEvent('Member', 'Join', `New user ${member.user.tag} joined and added to Appwrite: ${JSON.stringify(result)}`);
                }
            } catch (error) {
                console.error('Error handling guildMemberRejoin event:', error);
                handleClientError('Bot', 'GuildMemberRejoinError', `Error handling guildMemberRejoin event for ${member.user.tag}`, error);
            }
        });

        // Function to check and handle unverified members
        async function checkUnverifiedMembers() {
            try {
                const currentTimestamp = Date.now();
                const guild = await botClient.guilds.fetch(config.discord.guildId); // Fetch the guild

                guild.members.cache.forEach(async (member) => {
                    try {
                        const joinDate = member.joinedAt;
                        const daysSinceJoin = Math.floor((currentTimestamp - joinDate.getTime()) / (1000 * 60 * 60 * 24));

                        if (daysSinceJoin === ReminderDaysThreshold) {
                            const reminderMessage = new MessageEmbed()
                                .setColor('#ff9900')
                                .setTitle(`Reminder: Verify Your Account`)
                                .setDescription(`Hello ${member.user.username}, you have not verified your account yet. Please react with ✅ within the next ${KickDaysThreshold - ReminderDaysThreshold} days to avoid being kicked.`);

                            await member.send({ embeds: [reminderMessage] });
                            logEvent('Verification', 'Reminder', `Sent reminder to ${member.user.tag} to verify.`);
                        }

                        if (daysSinceJoin >= KickDaysThreshold) {
                            await member.kick('Failed to verify within the required time.');
                            logEvent('Verification', 'Kick', `Kicked ${member.user.tag} for not verifying within ${KickDaysThreshold} days.`);
                        }
                    } catch (error) {
                        console.error('Error checking or kicking unverified members:', error);
                        handleClientError('Bot', 'UnverifiedMembersCheckError', `Error checking or kicking unverified members for ${member.user.tag}`, error);
                    }
                });

            } catch (error) {
                console.error('Error in checkUnverifiedMembers function:', error);
                handleClientError('Bot', 'UnverifiedMembersCheckError', 'Error in checkUnverifiedMembers function', error);
            }
        }

        // Periodically check unverified members
        setInterval(checkUnverifiedMembers, 86400000);

    } catch (error) {
        handleClientError('Bot', 'LoginError', 'Failed to login', error);
    }
}

// Global error handler for uncaught exceptions
process.on('uncaughtException', err => {
    handleClientError('Bot', 'UncaughtException', 'Uncaught Exception', err);
});

// Start the bot by initializing everything
async function initializeAndStartBot() {
    try {
        await startBotClient(); // Start Discord bot client
    } catch (error) {
        handleClientError('Bot', 'StartError', 'Failed to start bot', error);
    }
}

initializeAndStartBot();
