const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Manage server backups')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all available backups')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('retrieve')
                .setDescription('Retrieve a specific backup')
                .addStringOption(option =>
                    option
                        .setName('filename')
                        .setDescription('The filename of the backup to retrieve')
                        .setRequired(true)
                )
        ),
    async execute(interaction) {
        const subCommand = interaction.options.getSubcommand();
        const backupDir = path.join(__dirname, '../backups'); // Define the backup directory

        if (subCommand === 'list') {
            const files = fs.readdirSync(backupDir);
            const backupFiles = files.filter(file => file.endsWith('.zip'));

            if (backupFiles.length > 0) {
                const list = backupFiles.map(file => `- ${file}`).join('\n');
                await interaction.reply(`Available backups:\n${list}`);
            } else {
                await interaction.reply('No backups found.');
            }
        } else if (subCommand === 'retrieve') {
            const filename = interaction.options.getString('filename');
            const filePath = path.join(backupDir, filename);

            if (fs.existsSync(filePath)) {
                await interaction.reply(`Backup file found: ${filename}`);
                // Implement file transfer logic, e.g., DMing the file to the user or saving it locally
            } else {
                await interaction.reply(`Backup file not found: ${filename}`);
            }
        }
    },
};
