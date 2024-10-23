const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');

// Fetch the appropriate log channel ID for the specific guild
function getLogChannelId(guildId) {
    if (guildId === config.discord.MCOGuild.guildId) {
        return config.discord.MCOGuild.channels.auditLogsChannelId;
    } else if (guildId === config.discord.MCOLOGGuild.guildId) {
        return config.discord.MCOLOGGuild.channels.auditLogsChannelId;
    } else {
        return null; // Handle any additional guilds or invalid IDs
    }
}

// Main function to set up audit logs
function setupAuditLogs(client) {

    // Audit Bans
    client.on('guildBanAdd', async (ban) => {
        try {
            console.log(`Processing guildBanAdd event for user: ${ban.user.tag}`);
            const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: 'MEMBER_BAN_ADD' });
            const banLog = fetchedLogs.entries.first();

            const logMessage = banLog
                ? `${ban.user.tag} was banned by ${banLog.executor.tag}.`
                : `No relevant audit logs were found for ${ban.user.tag}.`;

            console.log(logMessage);
            sendLog(ban.guild, 'User Banned', logMessage, ban.user.tag, ban.user.id, null);
        } catch (error) {
            console.error('Error fetching audit logs for ban:', error.message);
        }
    });

    // Audit Removed Bans
    client.on('guildBanRemove', async (ban) => {
        try {
            console.log(`Processing guildBanRemove event for user: ${ban.user.tag}`);
            const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: 'MEMBER_BAN_REMOVE' });
            const unbanLog = fetchedLogs.entries.first();

            const logMessage = unbanLog
                ? `${ban.user.tag} was unbanned by ${unbanLog.executor.tag}.`
                : `No relevant audit logs were found for ${ban.user.tag}.`;

            console.log(logMessage);
            sendLog(ban.guild, 'User Unbanned', logMessage, ban.user.tag, ban.user.id, null);
        } catch (error) {
            console.error('Error fetching audit logs for unban:', error.message);
        }
    });

    // Audit role updates
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        try {
            console.log(`Processing guildMemberUpdate event for user: ${newMember.user.tag}`);
            const fetchedLogs = await newMember.guild.fetchAuditLogs({ limit: 1, type: 'MEMBER_UPDATE' });
            const roleUpdateLog = fetchedLogs.entries.first();

            if (roleUpdateLog && roleUpdateLog.target.id === newMember.user.id) {
                const oldRoles = oldMember.roles.cache.map((role) => role.name);
                const newRoles = newMember.roles.cache.map((role) => role.name);
                const addedRoles = newRoles.filter((role) => !oldRoles.includes(role));
                const removedRoles = oldRoles.filter((role) => !newRoles.includes(role));

                let logMessage = '';
                addedRoles.forEach((role) => {
                    logMessage += `${role} was added to ${newMember.user.tag} by ${roleUpdateLog.executor.tag}\n`;
                });
                removedRoles.forEach((role) => {
                    logMessage += `${role} was removed from ${newMember.user.tag} by ${roleUpdateLog.executor.tag}\n`;
                });

                if (!logMessage) {
                    logMessage = `No roles were added or removed for ${newMember.user.tag}.`;
                }

                console.log(logMessage);
                sendLog(newMember.guild, 'Roles Updated', logMessage, newMember.user.tag, newMember.user.id, null);
            }
        } catch (error) {
            console.error('Error fetching audit logs for role update:', error.message);
        }
    });

    // Audit role creation
    client.on('roleCreate', async (role) => {
        try {
            const logMessage = `Role ${role.name} was created.`;
            console.log(logMessage);
            sendLog(role.guild, 'Role Created', logMessage, null, null, null);
        } catch (error) {
            console.error('Error logging role creation:', error.message);
        }
    });

    // Audit role deletion
    client.on('roleDelete', async (role) => {
        try {
            const logMessage = `Role ${role.name} was deleted.`;
            console.log(logMessage);
            sendLog(role.guild, 'Role Deleted', logMessage, null, null, null);
        } catch (error) {
            console.error('Error logging role deletion:', error.message);
        }
    });

    // Audit channel creation
    client.on('channelCreate', async (channel) => {
        try {
            const logMessage = `Channel ${channel.name} was created.`;
            console.log(logMessage);
            sendLog(channel.guild, 'Channel Created', logMessage, null, null, channel);
        } catch (error) {
            console.error('Error logging channel creation:', error.message);
        }
    });

    // Audit channel deletion
    client.on('channelDelete', async (channel) => {
        try {
            const logMessage = `Channel ${channel.name} was deleted.`;
            console.log(logMessage);
            sendLog(channel.guild, 'Channel Deleted', logMessage, null, null, channel);
        } catch (error) {
            console.error('Error logging channel deletion:', error.message);
        }
    });

    // Audit message sent
    client.on('messageCreate', async (message) => {
        try {
            if (message.author.bot) return; // Ignore bot messages
            const logMessage = `Message sent by ${message.author.tag}:\n**Content:** ${message.content}`;
            console.log(logMessage);
            sendLog(message.guild, 'Message Sent', logMessage, message.author.tag, message.author.id, message.channel);
        } catch (error) {
            console.error('Error logging message send:', error.message);
        }
    });

    // Audit message edits
    client.on('messageUpdate', async (oldMessage, newMessage) => {
        try {
            if (newMessage.author.bot) return; // Ignore bot messages
            const logMessage = `Message edited by ${newMessage.author.tag}:\n**Old Content:** ${oldMessage.content}\n**New Content:** ${newMessage.content}`;
            console.log(logMessage);
            sendLog(newMessage.guild, 'Message Edited', logMessage, newMessage.author.tag, newMessage.author.id, newMessage.channel);
        } catch (error) {
            console.error('Error logging message edit:', error.message);
        }
    });

    // Audit message deletion
    client.on('messageDelete', async (message) => {
        if (!message.guild) return; // Ensure the message is from a guild
    
        // Fetch audit logs for the deletion
        try {
            const fetchedLogs = await message.guild.fetchAuditLogs({
                limit: 1,
                type: 72, // Action type for message delete
            });
    
            const deletionLog = fetchedLogs.entries.first();
            if (!deletionLog) {
                console.log(`No logs found for message delete: ${message.id}`);
                return;
            }
    
            const { executor, target } = deletionLog;
    
            // Check if target is not null
            if (!target) {
                console.log(`No target found for message delete log entry.`);
                return;
            }
    
            // Check if the target is the deleted message author
            if (target.id === message.author.id) {
                console.log(`Message deleted by ${executor.tag}: ${message.content}`);
                // Call your sendLog function
                sendLog(message.guild, 'Message Delete', message.content, message.author.tag, message.author.id);
            } else {
                console.log('Message deleted, but the executor is not the author of the message.');
            }
    
            // Optionally check if executor is a bot and log
            if (executor) {
                const member = message.guild.members.cache.get(executor.id);
                if (member && member.user.bot) {
                    console.log(`${executor.tag} is a bot.`);
                } else {
                    console.log(`${executor.tag} is not a bot.`);
                }
            } else {
                console.log(`No executor found for the message delete log.`);
            }
        } catch (error) {
            console.error(`Error fetching audit logs for message delete: ${error.message}`);
        }
    });    
}

// Send log messages to the configured log channel
function sendLog(guild, eventType, message, userTag, userId, channel) {
    const logChannelId = getLogChannelId(guild.id);
    if (!logChannelId) {
        console.error(`No log channel configured for guild: ${guild.id}`);
        return;
    }

    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel) {
        console.error(`Log channel with ID ${logChannelId} not found in guild: ${guild.id}`);
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(`Event: ${eventType}`)
        .setDescription(message)
        .addFields(
            { name: 'User', value: userTag || 'N/A', inline: true },
            { name: 'User ID', value: userId || 'N/A', inline: true }
        )
        .setTimestamp()
        .setColor('#0099ff');

    if (channel) {
        embed.addFields({ name: 'Channel', value: channel.toString() });
    }

    logChannel.send({ embeds: [embed] })
        .catch(err => console.error('Error sending log message:', err));
}

// Export setupAuditLogs function
module.exports = setupAuditLogs;
