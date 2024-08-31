const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { logEvent } = require('../../shared/logger');
const config = require('../../config.json');
const { getAppwriteClient } = require('../../gateway/appwrite');

// Helper function to generate a 6-digit random number
const generateTicketId = () => {
    const ticketNumber = Math.floor(100000 + Math.random() * 900000);
    return `${ticketNumber}`;
};

// Helper function to get the ticket document
const getTicketDocument = async (ticketId) => {
    const { databases } = getAppwriteClient();
    return databases.listDocuments(
        config.appwrite.ticketSystem.ticketDatabaseId,
        config.appwrite.ticketSystem.ticketsCollectionId,
        [`ticketId=${ticketId}`]
    );
};

// Helper function to update the ticket status
const updateTicketStatus = async (ticketId, status) => {
    const { databases } = getAppwriteClient();
    const ticketDocs = await getTicketDocument(ticketId);

    if (ticketDocs.total > 0) {
        const ticketDoc = ticketDocs.documents[0];
        return databases.updateDocument(
            config.appwrite.ticketSystem.ticketDatabaseId,
            config.appwrite.ticketSystem.ticketsCollectionId,
            ticketDoc.$id,
            {
                status: status,
                updatedAt: new Date().toISOString()
            }
        );
    } else {
        throw new Error('Ticket not found');
    }
};

// Helper function to get a channel by ticket ID
const getChannelByTicketId = (guild, ticketId) => {
    return guild.channels.cache.find(ch => ch.name === `ticket-${ticketId}`);
};

// Helper function to create a ticket channel
const createTicketChannel = async (guild, ticketId, userId) => {
    return guild.channels.create({
        name: `ticket-${ticketId}`,
        type: 0,
        parent: config.discord.channels.ticketCategoryId,
        permissionOverwrites: [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: userId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
            },
            {
                id: config.discord.roles.staffRoleId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
            }
        ],
    });
};

// Ticket Commands
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
        const content = interaction.options.getString('content');

        if (!content) {
            return interaction.reply('Please provide details for the ticket.');
        }

        const { databases } = getAppwriteClient();

        if (!config.discord.roles || !config.discord.roles.staffRoleId) {
            console.error('Staff role ID is not defined in the configuration.');
            return interaction.reply('Configuration error: Staff role ID is missing.');
        }

        try {
            await interaction.deferReply();

            const ticketId = generateTicketId();

            await databases.createDocument(
                config.appwrite.ticketSystem.ticketDatabaseId,
                config.appwrite.ticketSystem.ticketsCollectionId,
                'unique()',
                {
                    ticketId: ticketId,
                    userId: userId,
                    description: content,
                    status: 'open',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            );

            const channel = await createTicketChannel(interaction.guild, ticketId, userId);

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Ticket Created')
                .setDescription(`Your ticket has been created! Ticket ID: ${ticketId}`)
                .setTimestamp();

            // Create a button to the support ticket
            const supportTicketButton = new ButtonBuilder()
                .setLabel('Go to Support Ticket')
                .setURL(`https://discord.com/channels/${interaction.guild.id}/${channel.id}`)
                .setStyle(ButtonStyle.Link);

            const actionRow = new ActionRowBuilder()
                .addComponents(supportTicketButton);

            await interaction.editReply({ embeds: [embed], components: [actionRow] });

            const channelLink = `https://discord.com/channels/${interaction.guild.id}/${channel.id}`;
            await interaction.user.send(`Your ticket has been created! Ticket ID: ${ticketId}. You can access it here: ${channelLink}`);

            logEvent('Ticket', 'Created', { userId, ticketId: ticketId });

        } catch (error) {
            console.error('Failed to create ticket:', error);
            if (interaction.deferred) {
                await interaction.editReply('There was an error creating your ticket. Please try again later.');
            } else {
                await interaction.reply('There was an error creating your ticket. Please try again later.');
            }
        }
    },

    // Command to close a ticket
    close: {
        data: new SlashCommandBuilder()
            .setName('close')
            .setDescription('Close a support ticket')
            .addStringOption(option =>
                option.setName('ticket_id')
                    .setDescription('The ID of the ticket to close')
                    .setRequired(true)),

        async execute(interaction) {
            const ticketId = interaction.options.getString('ticket_id');

            try {
                const channel = getChannelByTicketId(interaction.guild, ticketId);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('Close Ticket')
                        .setDescription(`Are you sure you want to close the ticket ${ticketId}?`)
                        .setTimestamp();

                    const confirmButton = new ButtonBuilder()
                        .setCustomId(`confirm_close_${ticketId}`)
                        .setLabel('Confirm')
                        .setStyle(ButtonStyle.Danger);

                    const cancelButton = new ButtonBuilder()
                        .setCustomId(`cancel_close_${ticketId}`)
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary);

                    const actionRow = new ActionRowBuilder()
                        .addComponents(confirmButton, cancelButton);

                    await interaction.reply({ embeds: [embed], components: [actionRow] });

                } else {
                    await interaction.reply('Ticket channel not found.');
                }

            } catch (error) {
                console.error('Failed to initiate close ticket:', error);
                await interaction.reply('There was an error initiating the close process. Please try again later.');
            }
        }
    },

    // Command to claim a ticket
    claim: {
        data: new SlashCommandBuilder()
            .setName('claim')
            .setDescription('Claim a support ticket')
            .addStringOption(option =>
                option.setName('ticket_id')
                    .setDescription('The ID of the ticket to claim')
                    .setRequired(true)),

        async execute(interaction) {
            const ticketId = interaction.options.getString('ticket_id');

            try {
                const ticketDocs = await getTicketDocument(ticketId);
                if (ticketDocs.total > 0) {
                    const ticketDoc = ticketDocs.documents[0];
                    if (ticketDoc.status === 'open') {
                        await updateTicketStatus(ticketId, 'claimed');

                        const channel = getChannelByTicketId(interaction.guild, ticketId);
                        if (channel) {
                            const embed = new EmbedBuilder()
                                .setColor('#00ff00')
                                .setTitle('Ticket Claimed')
                                .setDescription(`The ticket ${ticketId} has been claimed.`)
                                .setTimestamp();

                            await channel.send({ embeds: [embed] });
                        }

                        await interaction.reply(`Ticket ${ticketId} has been claimed.`);
                        logEvent('Ticket', 'Claimed', { ticketId: ticketId });

                    } else {
                        await interaction.reply(`Ticket ${ticketId} is not open or has already been claimed.`);
                    }
                } else {
                    await interaction.reply('Ticket not found.');
                }

            } catch (error) {
                console.error('Failed to claim ticket:', error);
                await interaction.reply('There was an error claiming the ticket. Please try again later.');
            }
        }
    },

    // Command to add a user to a ticket channel
    add: {
        data: new SlashCommandBuilder()
            .setName('add')
            .setDescription('Add a user to the ticket channel')
            .addStringOption(option =>
                option.setName('ticket_id')
                    .setDescription('The ID of the ticket')
                    .setRequired(true))
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The user to add to the ticket channel')
                    .setRequired(true)),

        async execute(interaction) {
            const ticketId = interaction.options.getString('ticket_id');
            const user = interaction.options.getUser('user');

            try {
                const channel = getChannelByTicketId(interaction.guild, ticketId);
                if (channel) {
                    await channel.permissionOverwrites.edit(user.id, {
                        ViewChannel: true,
                        SendMessages: true
                    });

                    const embed = new EmbedBuilder()
                        .setColor('#00ffff')
                        .setTitle('User Added')
                        .setDescription(`${user.username} has been added to the ticket channel.`)
                        .setTimestamp();

                    await channel.send({ embeds: [embed] });
                    await interaction.reply(`${user.username} has been added to the ticket channel.`);
                } else {
                    await interaction.reply('Ticket channel not found.');
                }

            } catch (error) {
                console.error('Failed to add user to ticket channel:', error);
                await interaction.reply('There was an error adding the user to the ticket channel. Please try again later.');
            }
        }
    },

    // Command to view a ticket
    view: {
        data: new SlashCommandBuilder()
            .setName('viewticket')
            .setDescription('View your support ticket')
            .addStringOption(option =>
                option.setName('ticket_id')
                    .setDescription('ID of the ticket')
                    .setRequired(true)),

        async execute(interaction) {
            const ticketId = interaction.options.getString('ticket_id');

            const appwriteClient = getAppwriteClient();

            try {
                const document = await appwriteClient.database.getDocument(
                    config.appwrite.ticketSystem.ticketsCollectionId,
                    ticketId
                );

                if (document.userId !== interaction.user.id) {
                    return interaction.reply('You do not have permission to view this ticket.');
                }

                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(`Ticket ID: ${ticketId}`)
                    .setDescription(`Content: ${document.description}`)
                    .addFields(
                        { name: 'Status', value: document.status, inline: true },
                        { name: 'Created At', value: new Date(document.createdAt).toLocaleString(), inline: true }
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });

            } catch (error) {
                console.error('Failed to retrieve ticket:', error);
                interaction.reply('There was an error retrieving your ticket. Please try again later.');
            }
        }
    },

    // Command to setup the ticket creation menu in the support channel
    setupMenu: {
        data: new SlashCommandBuilder()
            .setName('setupmenu')
            .setDescription('Set up the ticket creation menu in the support channel'),

        async execute(interaction) {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply('You do not have permission to setup the menu.');
            }

            try {
                const supportChannel = interaction.guild.channels.cache.get(config.discord.channels.supportChannelId);
                if (!supportChannel) {
                    return interaction.reply('Support channel not found.');
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('create_ticket_menu')
                    .setPlaceholder('Select to create a ticket')
                    .addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Create Ticket')
                            .setValue('create_ticket')
                            .setDescription('Click to create a new support ticket')
                    );

                const actionRow = new ActionRowBuilder()
                    .addComponents(selectMenu);

                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Ticket Creation Menu')
                    .setDescription('Select the option below to create a new support ticket.');

                await supportChannel.send({ embeds: [embed], components: [actionRow] });
                await interaction.reply('Ticket creation menu has been set up in the support channel.');
            } catch (error) {
                console.error('Failed to setup ticket menu:', error);
                await interaction.reply('There was an error setting up the ticket menu. Please try again later.');
            }
        }
    }
};

// Handle interaction with select menu
module.exports.handleSelectMenuInteraction = async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId === 'create_ticket_menu') {
        const selectedOption = interaction.values[0];

        if (selectedOption === 'create_ticket') {
            await interaction.reply('Please provide details for your support ticket using the `/ticket` command.');
        }
    }
};

// Handle button interactions
module.exports.handleButtonInteraction = async (interaction) => {
    if (!interaction.isButton()) return;

    const [action, ticketId] = interaction.customId.split('_');

    if (action === 'confirm_close') {
        try {
            await updateTicketStatus(ticketId, 'closed');

            const channel = getChannelByTicketId(interaction.guild, ticketId);
            if (channel) {
                await channel.delete(); // Delete the channel

                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('Ticket Closed')
                    .setDescription(`The ticket ${ticketId} has been closed and the channel has been deleted.`)
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
            } else {
                await interaction.reply('Ticket channel not found.');
            }

            logEvent('Ticket', 'Closed and Deleted', { ticketId: ticketId });

        } catch (error) {
            console.error('Failed to close ticket:', error);
            await interaction.reply('There was an error closing the ticket. Please try again later.');
        }
    } else if (action === 'cancel_close') {
        await interaction.reply('Ticket closure has been canceled.');
    }
};
