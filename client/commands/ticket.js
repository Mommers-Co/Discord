const { SlashCommandBuilder, EmbedBuilder } = require('discord.js'); // Import SlashCommandBuilder
const { logEvent } = require('../../shared/logger');
const config = require('../../config.json');
const { getAppwriteClient } = require('../../gateway/appwrite');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Create a support ticket')
        .addStringOption(option =>
            option.setName('content')
                .setDescription('Details of the support ticket')
                .setRequired(true)),
    async execute(interaction) {
        const userId = interaction.user.id;
        const content = interaction.options.getString('content'); // Adjust to use options

        if (!content) {
            return interaction.reply('Please provide details for the ticket.');
        }

        const appwriteClient = getAppwriteClient();

        try {
            const response = await appwriteClient.database.createDocument(
                config.appwrite.ticketSystem.ticketsCollectionId,
                'unique()',
                {
                    userId,
                    content,
                    status: 'open',
                    createdAt: new Date().toISOString(),
                }
            );

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Ticket Created')
                .setDescription(`Your ticket has been created! Ticket ID: ${response.$id}`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            logEvent('Ticket', 'Created', { userId, ticketId: response.$id });

        } catch (error) {
            console.error('Failed to create ticket:', error);
            interaction.reply('There was an error creating your ticket. Please try again later.');
        }
    },
};
