const { Client, MessageEmbed, GatewayIntentBits } = require('discord.js');
const { logEvent } = require('../shared/logger');
const config = require('../config.json');
const { getAppwriteClient } = require('../gateway/appwrite');

const RoleID = config.roles.memberId;
const WelcomeChannelID = config.channels.welcomeChannelId;
const KickDaysThreshold = 10;
const ReminderDaysThreshold = 7;

let client;
let appwriteClient;
let memberJoinDates = new Map();

console.log('Waiting for start signal from gateway...');

// Listen for start signal from gateway.js
process.on('message', message => {
    if (message === 'StartClient') {
        startDiscordClient();
    }
});

// Function to start the Discord client
async function startDiscordClient() {
    try {
        const intents = new GatewayIntentBits([
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContents
        ]);

        client = new Client({ 
            intents,
            allowedMentions: { parse: ['users', 'roles'], repliedUser: true }
        });

        // Event: When a member joins the server
        client.on('guildMemberAdd', async member => {
            try {
                if (!client.readyAt) {
                    console.log('Discord client not initialized. Waiting for client to be ready...');
                    return;
                }

                const joinedAt = member.joinedAt;
                memberJoinDates.set(member.id, joinedAt);

                const welcomeChannel = await client.channels.fetch(WelcomeChannelID);
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
            }
        });

        // Event: When a member leaves the server
        client.on('guildMemberRemove', async member => {
            try {
                if (!client.readyAt) {
                    console.log('Discord client not initialized. Waiting for client to be ready...');
                    return;
                }

                // Update Appwrite database to mark user as inactive or left
                const appwrite = getAppwriteClient();
                const usersCollection = appwrite.database.collection('users');
                const result = await usersCollection.updateDocument(member.id, {
                    active: false,
                    lastAction: 'Left the server',
                    leftAt: new Date().toISOString()
                });

                logEvent('Member', 'Remove', `User ${member.user.tag} updated in Appwrite: ${JSON.stringify(result)}`);
            } catch (error) {
                console.error('Error updating user in Appwrite on guildMemberRemove:', error);
            }
        });

        // Event: When a member rejoins the server
        client.on('guildMemberAdd', async member => {
            try {
                if (!client.readyAt) {
                    console.log('Discord client not initialized. Waiting for client to be ready...');
                    return;
                }

                // Check if user already exists in Appwrite, update if exists, create new if not
                const appwrite = getAppwriteClient();
                const usersCollection = appwrite.database.collection('users');
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
            }
        });

        // Check unverified members periodically
        setInterval(() => {
            if (!client.readyAt) {
                console.log('Discord client not initialized. Waiting for client to be ready...');
                return;
            }

            const currentTimestamp = Date.now();
            memberJoinDates.forEach(async (joinDate, memberId) => {
                try {
                    const daysSinceJoin = Math.floor((currentTimestamp - joinDate.getTime()) / (1000 * 60 * 60 * 24));

                    if (daysSinceJoin === ReminderDaysThreshold) {
                        const memberToRemind = await client.guilds.cache.get(config.discord.guildId).members.fetch(memberId);
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
                        const guild = client.guilds.cache.get(config.discord.guildId);
                        const memberToKick = guild.members.cache.get(memberId);
                        if (memberToKick) {
                            await memberToKick.kick('Failed to verify within the required time.');
                            logEvent('Verification', 'Kick', `Kicked ${memberToKick.user.tag} for not verifying within ${KickDaysThreshold} days.`);
                            memberJoinDates.delete(memberId);
                        }
                    }
                } catch (error) {
                    console.error('Error checking or kicking unverified members:', error);
                }
            });
        }, 86400000);

        client.login(config.discord.clientToken);
        logEvent('Client', 'Login', `Logged in as ${client.user.tag}`);
        console.log(`Logged in as ${client.user.tag}`);

        process.send('ClientOnline'); // Signal gateway.js that client is online
    } catch (error) {
        handleClientError('Client', 'LoginError', 'Failed to login', error);
        process.send(`ClientError: ${error.message}`);
    }
}

// Function to handle client errors
function handleClientError(module, event, message, error) {
    const errorMessage = error instanceof Error ? error.message : error;
    logEvent(module, event, `${message}: ${errorMessage}`);
    console.error(message, error);
}

// Function to get the Appwrite client
function getAppwriteClient() {
    if (!appwriteClient) {
        throw new Error('Appwrite client is not initialized.');
    }
    return appwriteClient;
}

module.exports = { startDiscordClient, getAppwriteClient };
