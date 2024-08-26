const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),
    async execute(interaction) {
        try {
            await interaction.reply('Pong!');
        } catch (error) {
            console.error(`Failed to reply to ping interaction: ${error.message}`);
            await interaction.followUp({ content: 'Something went wrong!', ephemeral: true });
        }
    },
};
