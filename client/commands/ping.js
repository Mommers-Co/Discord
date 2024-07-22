const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),
    async execute(interaction) {
        try {
            await interaction.reply('Pong!');
            console.log('Ping Command Executed:', { user: interaction.user.tag });
        } catch (error) {
            console.error('Ping Command Error:', error.message);
        }
    },
};
