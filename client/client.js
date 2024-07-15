const { Client, MessageEmbed, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config.json');
const { initializeAppwriteClient } = require('./appwrite');
const { getAppwriteClient } = require('./gateway/appwrite');
const { logEvent } = require('./shared/logger');

const RoleID = config.roles.memberId;
const WelcomeChannelID = config.channels.welcomeChannelId;
const KickDaysThreshold = 10;
const ReminderDaysThreshold = 7;

let botClient;
let memberJoinDates = new Map();

console.log('Starting bot...');

// Initialize Discord client
async function startBotClient() {
    try {
        botClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages // Include all necessary intents
            ],
            partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember, Partials.User],
            allowedMentions: { parse: ['users', 'roles'], repliedUser: true }
        });

        await botClient.login(config.discord.botToken);
        logEvent('Bot', 'Login', `Logged in as ${botClient.user.tag}`);
        console.log(`Logged in as ${botClient.user.tag}`);

        await initializeAppwriteClient(); // Initialize Appwrite client

        // Event: When the bot is ready
        botClient.once('ready', () => {
            console.log(`Bot ready as ${botClient.user.tag}`);
            logEvent('Bot', 'Ready', `Bot ready as ${botClient.user.tag}`);

            // Periodic check for unverified members
            setInterval(checkUnverifiedMembers, 86400000);
        });

        // Event: When a member joins the server
        botClient.on('guildMemberAdd', handleGuildMemberAdd);

        // Event: When a member leaves the server
        botClient.on('guildMemberRemove', handleGuildMemberRemove);

        // Event: When a member rejoins the server
        botClient.on('guildMemberAdd', handleGuildMemberRejoin);

    } catch (error) {
        handleClientError('Bot', 'LoginError', 'Failed to login', error);
    }
}

// Function to handle guild member addition
async function handleGuildMemberAdd(member) {
    try {
        const joinedAt = member.joinedAt;
        memberJoinDates.set(member.id, joinedAt);

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
}

// Function to handle guild member removal
async function handleGuildMemberRemove(member) {
    try {
        // Update Appwrite database to mark user as inactive or left
        const appwrite = getAppwriteClient();
        const usersCollection = appwrite.database.collection(config.appwrite.discordDatabase.usersCollectionId);
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
}

// Function to handle guild member rejoining
async function handleGuildMemberRejoin(member) {
    try {
        // Check if user already exists in Appwrite, update if exists, create new if not
        const appwrite = getAppwriteClient();
        const usersCollection = appwrite.database.collection(config.appwrite.discordDatabase.usersCollectionId);
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
        console.error('Error handling guildMemberAdd event:', error);
        handleClientError('Bot', 'GuildMemberAddError', `Error handling guildMemberAdd event for ${member.user.tag}`, error);
    }
}

// Function to check and handle unverified members
async function checkUnverifiedMembers() {
    try {
        const currentTimestamp = Date.now();
        memberJoinDates.forEach(async (joinDate, memberId) => {
            try {
                const daysSinceJoin = Math.floor((currentTimestamp - joinDate.getTime()) / (1000 * 60 * 60 * 24));

                if (daysSinceJoin === ReminderDaysThreshold) {
                    const memberToRemind = await botClient.guilds.cache.get(config.discord.guildId).members.fetch(memberId);
                    if (memberToRemind) {
                        const reminderMessage = new MessageEmbed()
                            .setColor('#ff9900')
                            .setTitle(`Reminder: Verify Your Account`)
                            .setDescription(`Hello ${memberToRemind.user.username}, you have not verified your account yet. Please react with ✅ within the next ${KickDaysThreshold - ReminderDaysThreshold} days to avoid being kicked.`);

                        await memberToRemind.send({ embeds: [reminderMessage] });
                        logEvent('Verification', 'Reminder', `Sent reminder to ${memberToRemind.user.tag} to verify.`);
                    }
                }

                if (daysSinceJoin >= KickDaysThreshold) {
                    const guild = botClient.guilds.cache.get(config.discord.guildId);
                    const memberToKick = guild.members.cache.get(memberId);
                    if (memberToKick) {
                        await memberToKick.kick('Failed to verify within the required time.');
                        logEvent('Verification', 'Kick', `Kicked ${memberToKick.user.tag} for not verifying within ${KickDaysThreshold} days.`);
                        memberJoinDates.delete(memberId);
                    }
                }
            } catch (error) {
                console.error('Error checking or kicking unverified members:', error);
                handleClientError('Bot', 'UnverifiedMembersCheckError', `Error checking or kicking unverified members for ${memberId}`, error);
            }
        });
    } catch (error) {
        console.error('Error in checkUnverifiedMembers function:', error);
        handleClientError('Bot', 'UnverifiedMembersCheckError', 'Error in checkUnverifiedMembers function', error);
    }
}

// Global error handler for uncaught exceptions
process.on('uncaughtException', err => {
    handleClientError('Bot', 'UncaughtException', 'Uncaught Exception', err);
});

// Function to handle client errors
function handleClientError(module, event, description, error) {
    console.error(`[${module}] [${event}] ${description}:`, error);
    // Additional error handling or logging here if needed
}

// Start the bot by initializing everything
async function initializeAndStartBot() {
    try {
        await startBotClient(); // Start Discord bot client
    } catch (error) {
        handleClientError('Bot', 'StartError', 'Failed to start bot', error);
    }
}

initializeAndStartBot();
