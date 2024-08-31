const { Client, EmbedBuilder } = require('discord.js');
const config = require('../config.json');

const LOG_CHANNEL_ID = config.discord.channels.auditLogsChannelId;

function setupAuditLogs(client) {
    client.on('guildBanAdd', async ban => {
        try {
            console.log(`Processing guildBanAdd event for user: ${ban.user.tag}`);

            const fetchedLogs = await ban.guild.fetchAuditLogs({
                limit: 1,
                type: 22, // Numeric value for MEMBER_BAN_ADD
            });
            const banLog = fetchedLogs.entries.first();

            if (!banLog) {
                const message = `No relevant audit logs were found for ${ban.user.tag}.`;
                console.log(message);
                sendLog(ban.guild, 'User Banned', message, ban.user.tag, ban.user.id, null);
                return;
            }

            const { executor, target } = banLog;

            let logMessage;
            if (target.id === ban.user.id) {
                logMessage = `${ban.user.tag} was banned by ${executor.tag}.`;
            } else {
                logMessage = `${ban.user.tag} was banned, but the audit log shows a different user was targeted.`;
            }
            console.log(logMessage);
            sendLog(ban.guild, 'User Banned', logMessage, ban.user.tag, ban.user.id, null);
        } catch (error) {
            console.error('Error fetching audit logs for ban:', error);
        }
    });

    client.on('guildBanRemove', async ban => {
        try {
            console.log(`Processing guildBanRemove event for user: ${ban.user.tag}`);

            const fetchedLogs = await ban.guild.fetchAuditLogs({
                limit: 1,
                type: 23, // Numeric value for MEMBER_BAN_REMOVE
            });
            const unbanLog = fetchedLogs.entries.first();

            if (!unbanLog) {
                const message = `No relevant audit logs were found for ${ban.user.tag}.`;
                console.log(message);
                sendLog(ban.guild, 'User Unbanned', message, ban.user.tag, ban.user.id, null);
                return;
            }

            const { executor, target } = unbanLog;

            let logMessage;
            if (target.id === ban.user.id) {
                logMessage = `${ban.user.tag} was unbanned by ${executor.tag}.`;
            } else {
                logMessage = `${ban.user.tag} was unbanned, but the audit log shows a different user was targeted.`;
            }
            console.log(logMessage);
            sendLog(ban.guild, 'User Unbanned', logMessage, ban.user.tag, ban.user.id, null);
        } catch (error) {
            console.error('Error fetching audit logs for unban:', error);
        }
    });

    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        try {
            console.log(`Processing guildMemberUpdate event for user: ${newMember.user.tag}`);
    
            // Fetch audit logs related to role updates
            const fetchedLogs = await newMember.guild.fetchAuditLogs({
                limit: 1,
                type: 24, // Numeric value for MEMBER_ROLE_UPDATE
            });
            const roleUpdateLog = fetchedLogs.entries.first();
    
            if (!roleUpdateLog) {
                const message = `No relevant audit logs were found for ${newMember.user.tag}.`;
                console.log(message);
                sendLog(newMember.guild, 'Roles Updated', message, newMember.user.tag, newMember.user.id, null);
                return;
            }
    
            const { executor, target } = roleUpdateLog;
    
            if (target.id === newMember.user.id) {
                const oldRoles = oldMember.roles.cache.map(role => role.id);
                const newRoles = newMember.roles.cache.map(role => role.id);
                const addedRoles = newRoles.filter(roleId => !oldRoles.includes(roleId)).map(roleId => newMember.guild.roles.cache.get(roleId)?.name || 'Unknown');
                const removedRoles = oldRoles.filter(roleId => !newRoles.includes(roleId)).map(roleId => oldMember.guild.roles.cache.get(roleId)?.name || 'Unknown');
    
                let logMessage = '';
    
                addedRoles.forEach(roleName => {
                    logMessage += `${roleName} was added to ${newMember.user.tag} by ${executor.tag}\n`;
                });
                
                removedRoles.forEach(roleName => {
                    logMessage += `${roleName} was removed from ${newMember.user.tag} by ${executor.tag}\n`;
                });
    
                if (!addedRoles.length && !removedRoles.length) {
                    logMessage = `No roles were added or removed for ${newMember.user.tag}.`;
                }
    
                console.log(logMessage);
                sendLog(newMember.guild, 'Roles Updated', logMessage, newMember.user.tag, newMember.user.id, null);
            } else {
                const message = `The audit log shows a different user was targeted for role updates of ${newMember.user.tag}.`;
                console.log(message);
                sendLog(newMember.guild, 'Roles Updated', message, newMember.user.tag, newMember.user.id, null);
            }
        } catch (error) {
            console.error('Error fetching audit logs for role update:', error);
        }
    });

    client.on('messageDelete', async message => {
        try {
            console.log(`Processing messageDelete event for message by ${message.author.tag}`);

            const fetchedLogs = await message.guild.fetchAuditLogs({
                limit: 1,
                type: 72, // Numeric value for MESSAGE_DELETE
            });
            const deletionLog = fetchedLogs.entries.first();

            const messageContent = message.content ? message.content : 'No content';

            let logMessage;
            if (!deletionLog) {
                logMessage = `**Content:** ${messageContent}`;
            } else {
                const { executor, target } = deletionLog;
                if (target.id === message.author.id) {
                    logMessage = `Message by ${message.author.tag} was deleted by ${executor.tag}.\n**Content:** ${messageContent}`;
                } else {
                    logMessage = `Message by ${message.author.tag} was deleted, but the audit log shows a different user was targeted.\n**Content:** ${messageContent}`;
                }
            }
            console.log(logMessage);
            sendLog(message.guild, 'Message Deleted', logMessage, message.author.tag, message.author.id, message.channel);
        } catch (error) {
            console.error('Error fetching audit logs for message delete:', error);
        }
    });

    client.on('messageUpdate', async (oldMessage, newMessage) => {
        try {
            if (oldMessage.content === newMessage.content) return;

            console.log(`Processing messageUpdate event for message by ${newMessage.author.tag}`);

            const fetchedLogs = await newMessage.guild.fetchAuditLogs({
                limit: 1,
                type: 74, // Numeric value for MESSAGE_UPDATE
            });
            const editLog = fetchedLogs.entries.first();

            const messageLink = `https://discord.com/channels/${newMessage.guild.id}/${newMessage.channel.id}/${newMessage.id}`;

            const logMessage = `**Before:** ${oldMessage.content}\n**After:** ${newMessage.content}\n[Message Link](${messageLink})`;
            console.log(logMessage);
            sendLog(newMessage.guild, 'Message Edited', logMessage, newMessage.author.tag, newMessage.author.id, newMessage.channel);
        } catch (error) {
            console.error('Error fetching audit logs for message update:', error);
        }
    });

    client.on('messageCreate', async message => {
        if (message.author.bot) return;

        const messageLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
        const logMessage = `**Content:** ${message.content}\n[Message Link](${messageLink})`;
        console.log(logMessage);
        sendLog(message.guild, 'Message Sent', logMessage, message.author.tag, message.author.id, message.channel);
    });

    // Channel Create Event
    client.on('channelCreate', async channel => {
        try {
            console.log(`Processing channelCreate event for channel: ${channel.name}`);
            const logMessage = `**Channel Name:** ${channel.name}\n**Channel ID:** ${channel.id}`;
            sendLog(channel.guild, 'Channel Created', logMessage, 'N/A', 'N/A', channel);
        } catch (error) {
            console.error('Error processing channelCreate event:', error);
        }
    });

    // Channel Update Event
    client.on('channelUpdate', async (oldChannel, newChannel) => {
        try {
            if (oldChannel.name === newChannel.name) return;

            console.log(`Processing channelUpdate event for channel: ${oldChannel.name}`);
            const logMessage = `**Old Name:** ${oldChannel.name}\n**New Name:** ${newChannel.name}\n**Channel ID:** ${newChannel.id}`;
            sendLog(newChannel.guild, 'Channel Updated', logMessage, 'N/A', 'N/A', newChannel);
        } catch (error) {
            console.error('Error processing channelUpdate event:', error);
        }
    });

    // Channel Delete Event
    client.on('channelDelete', async channel => {
        try {
            console.log(`Processing channelDelete event for channel: ${channel.name}`);
            const logMessage = `**Channel Name:** ${channel.name}\n**Channel ID:** ${channel.id}`;
            sendLog(channel.guild, 'Channel Deleted', logMessage, 'N/A', 'N/A', channel);
        } catch (error) {
            console.error('Error processing channelDelete event:', error);
        }
    });
}

function sendLog(guild, title, logMessage, authorTag, userId, channel) {
    const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
        const channelName = channel ? `<#${channel.id}>` : 'N/A'; // Format channel name as a clickable link

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(title)
            .setDescription(logMessage)
            .addFields(
                { name: 'User', value: `${authorTag}`, inline: true },
                { name: 'User ID', value: `${userId}`, inline: true },
                { name: 'Channel', value: `${channelName}`, inline: true } // Add clickable channel link
            )
            .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(console.error);
    } else {
        console.warn(`Log channel with ID ${LOG_CHANNEL_ID} not found.`);
    }
}

module.exports = { setupAuditLogs };
