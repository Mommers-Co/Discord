const { Client, EmbedBuilder } = require('discord.js');
const config = require('../config.json');

// Update this line to fetch the channel ID based on the specific guild
const LOG_CHANNEL_ID = config.discord.MCOGuild.channels.auditLogsChannelId;

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
            const logMessage = target.id === ban.user.id 
                ? `${ban.user.tag} was banned by ${executor.tag}.`
                : `${ban.user.tag} was banned, but the audit log shows a different user was targeted.`;

            console.log(logMessage);
            sendLog(ban.guild, 'User Banned', logMessage, ban.user.tag, ban.user.id, null);
        } catch (error) {
            console.error('Error fetching audit logs for ban:', error.message);
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
            const logMessage = target.id === ban.user.id 
                ? `${ban.user.tag} was unbanned by ${executor.tag}.`
                : `${ban.user.tag} was unbanned, but the audit log shows a different user was targeted.`;

            console.log(logMessage);
            sendLog(ban.guild, 'User Unbanned', logMessage, ban.user.tag, ban.user.id, null);
        } catch (error) {
            console.error('Error fetching audit logs for unban:', error.message);
        }
    });

    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        try {
            console.log(`Processing guildMemberUpdate event for user: ${newMember.user.tag}`);

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
            console.error('Error fetching audit logs for role update:', error.message);
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
                logMessage = target.id === message.author.id 
                    ? `Message by ${message.author.tag} was deleted by ${executor.tag}.\n**Content:** ${messageContent}`
                    : `Message by ${message.author.tag} was deleted, but the audit log shows a different user was targeted.\n**Content:** ${messageContent}`;
            }
            console.log(logMessage);
            sendLog(message.guild, 'Message Deleted', logMessage, message.author.tag, message.author.id, message.channel);
        } catch (error) {
            console.error('Error fetching audit logs for message delete:', error.message);
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
            console.error('Error fetching audit logs for message update:', error.message);
        }
    });

    client.on('messageCreate', async message => {
        if (message.author.bot) return;

        const messageLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
        const logMessage = `**Content:** ${message.content}\n[Message Link](${messageLink})`;
        console.log(logMessage);
        sendLog(message.guild, 'Message Sent', logMessage, message.author.tag, message.author.id, message.channel);
    });

    client.on('channelCreate', async channel => {
        try {
            console.log(`Processing channelCreate event for channel: ${channel.name}`);
            const logMessage = `**Channel Name:** ${channel.name}\n**Channel ID:** ${channel.id}`;
            sendLog(channel.guild, 'Channel Created', logMessage, 'N/A', 'N/A', channel);
        } catch (error) {
            console.error('Error processing channelCreate event:', error.message);
        }
    });

    client.on('channelUpdate', async (oldChannel, newChannel) => {
        try {
            if (oldChannel.name === newChannel.name) return;

            console.log(`Processing channelUpdate event for channel: ${oldChannel.name}`);
            const logMessage = `**Old Name:** ${oldChannel.name}\n**New Name:** ${newChannel.name}\n**Channel ID:** ${newChannel.id}`;
            sendLog(newChannel.guild, 'Channel Updated', logMessage, 'N/A', 'N/A', newChannel);
        } catch (error) {
            console.error('Error processing channelUpdate event:', error.message);
        }
    });

    client.on('channelDelete', async channel => {
        try {
            console.log(`Processing channelDelete event for channel: ${channel.name}`);
            const logMessage = `**Channel Name:** ${channel.name}\n**Channel ID:** ${channel.id}`;
            sendLog(channel.guild, 'Channel Deleted', logMessage, 'N/A', 'N/A', channel);
        } catch (error) {
            console.error('Error processing channelDelete event:', error.message);
        }
    });

    client.on('roleCreate', async role => {
        try {
            console.log(`Processing roleCreate event for role: ${role.name}`);
            const logMessage = `**Role Name:** ${role.name}\n**Role ID:** ${role.id}`;
            sendLog(role.guild, 'Role Created', logMessage, 'N/A', 'N/A', role);
        } catch (error) {
            console.error('Error processing roleCreate event:', error.message);
        }
    });

    client.on('roleUpdate', async (oldRole, newRole) => {
        try {
            if (oldRole.name === newRole.name) return;

            console.log(`Processing roleUpdate event for role: ${oldRole.name}`);
            const logMessage = `**Old Name:** ${oldRole.name}\n**New Name:** ${newRole.name}\n**Role ID:** ${newRole.id}`;
            sendLog(newRole.guild, 'Role Updated', logMessage, 'N/A', 'N/A', newRole);
        } catch (error) {
            console.error('Error processing roleUpdate event:', error.message);
        }
    });

    client.on('roleDelete', async role => {
        try {
            console.log(`Processing roleDelete event for role: ${role.name}`);
            const logMessage = `**Role Name:** ${role.name}\n**Role ID:** ${role.id}`;
            sendLog(role.guild, 'Role Deleted', logMessage, 'N/A', 'N/A', role);
        } catch (error) {
            console.error('Error processing roleDelete event:', error.message);
        }
    });
}

function sendLog(guild, eventType, message, userTag, userId, extra) {
    const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle(`Event: ${eventType}`)
        .setDescription(message)
        .addField('User', userTag || 'N/A', true)
        .addField('User ID', userId || 'N/A', true)
        .setTimestamp()
        .setColor('#FF0000');

    if (extra) {
        embed.addField('Additional Info', extra.toString() || 'N/A');
    }

    logChannel.send({ embeds: [embed] });
}

module.exports = setupAuditLogs;
