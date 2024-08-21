const { EmbedBuilder } = require('discord.js');
const { getUserByDiscordId, updateUserInDatabase } = require('../gateway/appwrite');
const { logEvent } = require('../shared/logger');
const config = require('../config.json');

// Function to add a note to a user
async function addNoteToUser(client, userId, note) {
    try {
        const user = await getUserByDiscordId(userId);
        if (!user) {
            throw new Error(`User with ID ${userId} not found in database.`);
        }

        const updatedUser = {
            ...user,
            notes: user.notes ? `${user.notes}\n${note}` : note
        };

        await updateUserInDatabase(userId, updatedUser);
        const channel = await client.channels.fetch(config.discord.channels.modLogsChannelId);
        if (channel) {
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Note Added')
                .setDescription(`Note added to <@${userId}>`)
                .addFields(
                    { name: 'User', value: `<@${userId}>`, inline: true },
                    { name: 'Note', value: note, inline: false }
                )
                .setTimestamp();

            await channel.send({ embeds: [embed] });
            logEvent('NoteAdded', 'UserNote', { userId, note });
        }
    } catch (error) {
        console.error('Failed to add note:', error);
        logEvent('NoteAddError', 'Error', error.message);
    }
}

// Function to ban a user
async function banUser(client, member, reason) {
    try {
        await member.ban({ reason });
        const channel = await client.channels.fetch(config.discord.channels.modLogsChannelId);
        if (channel) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('User Banned')
                .setDescription(`${member.user.tag} has been banned.`)
                .addFields(
                    { name: 'User', value: `<@${member.id}>`, inline: true },
                    { name: 'Reason', value: reason, inline: false }
                )
                .setTimestamp();

            await channel.send({ embeds: [embed] });
            logEvent('UserBanned', 'Moderation', { userId: member.id, reason });
        }
    } catch (error) {
        console.error('Failed to ban user:', error);
        logEvent('BanError', 'Error', error.message);
    }
}

// Function to kick a user
async function kickUser(client, member, reason) {
    try {
        await member.kick(reason);
        const channel = await client.channels.fetch(config.discord.channels.modLogsChannelId);
        if (channel) {
            const embed = new EmbedBuilder()
                .setColor('#ffff00')
                .setTitle('User Kicked')
                .setDescription(`${member.user.tag} has been kicked.`)
                .addFields(
                    { name: 'User', value: `<@${member.id}>`, inline: true },
                    { name: 'Reason', value: reason, inline: false }
                )
                .setTimestamp();

            await channel.send({ embeds: [embed] });
            logEvent('UserKicked', 'Moderation', { userId: member.id, reason });
        }
    } catch (error) {
        console.error('Failed to kick user:', error);
        logEvent('KickError', 'Error', error.message);
    }
}

// Function to update a user's status and record of actions
async function updateUserStatus(client, userId, updateData) {
    try {
        const user = await getUserByDiscordId(userId);
        if (!user) {
            throw new Error(`User with ID ${userId} not found in database.`);
        }

        const updatedUser = {
            ...user,
            ...updateData
        };

        await updateUserInDatabase(userId, updatedUser);
        logEvent('UserStatusUpdated', 'Moderation', { userId, updateData });

        const channel = await client.channels.fetch(config.discord.channels.modLogsChannelId);
        if (channel) {
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('User Status Updated')
                .setDescription(`User <@${userId}> status updated.`)
                .addFields(
                    { name: 'User', value: `<@${userId}>`, inline: true },
                    { name: 'Update Data', value: JSON.stringify(updateData, null, 2), inline: false }
                )
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Failed to update user status:', error);
        logEvent('UserStatusUpdateError', 'Error', error.message);
    }
}

// Export the moderation functions
module.exports = {
    addNoteToUser,
    banUser,
    kickUser,
    updateUserStatus
};
