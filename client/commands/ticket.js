// /Discord/commands/ticket.js
const { Client, MessageEmbed } = require('discord.js');
const { logEvent } = require('../shared/logger');
const { getAppwriteClient } = require('../gateway/appwrite');
const config = require('../config.json');

// Initialize Appwrite client
const appwriteClient = getAppwriteClient();

module.exports = {
    name: 'ticket',
    description: 'Create a support ticket',
    async execute(message, args) {
        const userId = message.author.id;
        const content = args.join(' ');

        if (!content) {
            return message.reply('Please provide details for the ticket.');
        }

        try {
            const response = await appwriteClient.database.createDocument('tickets', 'unique()', {
                userId,
                content,
                status: 'open',
                createdAt: new Date().toISOString(),
            });

            const embed = new MessageEmbed()
                .setColor('#0099ff')
                .setTitle('Ticket Created')
                .setDescription(`Your ticket has been created! Ticket ID: ${response.$id}`)
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });
            logEvent('Ticket', 'Created', { userId, ticketId: response.$id });

        } catch (error) {
            console.error('Failed to create ticket:', error);
            message.reply('There was an error creating your ticket. Please try again later.');
        }
    },
};
