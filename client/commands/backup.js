const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');
const { runBackup, runBackupWithoutMessages, restoreBackup } = require('../../gateway/backup'); // Adjust the path accordingly

const backupDir = path.join(__dirname, '../../backups');

// Ensure the backups directory exists
fs.ensureDirSync(backupDir);

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
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new backup')
                .addBooleanOption(option =>
                    option
                        .setName('withoutmessages')
                        .setDescription('Create a backup without messages')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('restore')
                .setDescription('Restore a backup')
                .addStringOption(option =>
                    option
                        .setName('filename')
                        .setDescription('The filename of the backup to restore')
                        .setRequired(true)
                )
        ),
    async execute(interaction) {
        const subCommand = interaction.options.getSubcommand();
        const backupDir = path.join(__dirname, '../../backups'); // Ensure this path is consistent

        if (subCommand === 'list') {
            try {
                const files = await fs.readdir(backupDir);
                const backupFiles = files.filter(file => file.endsWith('.zip'));

                if (backupFiles.length > 0) {
                    const list = backupFiles.map(file => `- ${file}`).join('\n');
                    await interaction.reply(`Available backups:\n${list}`);
                } else {
                    await interaction.reply('No backups found.');
                }
            } catch (error) {
                console.error(`Failed to list backups: ${error.message}`);
                await interaction.reply('Failed to list backups.');
            }
        } else if (subCommand === 'retrieve') {
            const filename = interaction.options.getString('filename');
            const filePath = path.join(backupDir, filename);

            try {
                if (await fs.pathExists(filePath)) {
                    const attachment = new AttachmentBuilder(filePath);
                    await interaction.reply({ content: `Backup file found: ${filename}`, files: [attachment] });
                } else {
                    await interaction.reply(`Backup file not found: ${filename}`);
                }
            } catch (error) {
                console.error(`Failed to retrieve backup: ${error.message}`);
                await interaction.reply('Failed to retrieve the backup file.');
            }
        } else if (subCommand === 'create') {
            const withoutMessages = interaction.options.getBoolean('withoutmessages') || false;
            try {
                await interaction.reply('Creating backup...');
                if (withoutMessages) {
                    await runBackupWithoutMessages(interaction.client); // Call the function to run backup without messages
                } else {
                    await runBackup(interaction.client); // Call the function to run a full backup
                }
                await interaction.followUp('Backup creation complete.');
            } catch (error) {
                console.error(`Failed to create backup: ${error.message}`);
                await interaction.followUp('Failed to create the backup.');
            }
        } else if (subCommand === 'restore') {
            const filename = interaction.options.getString('filename');
            const filePath = path.join(backupDir, filename);

            try {
                if (await fs.pathExists(filePath)) {
                    await interaction.reply('Restoring backup...');
                    await restoreBackup(interaction.client, filePath);
                    await interaction.followUp('Backup restore complete.');
                } else {
                    await interaction.reply(`Backup file not found: ${filename}`);
                }
            } catch (error) {
                console.error(`Failed to restore backup: ${error.message}`);
                await interaction.followUp('Failed to restore the backup.');
            }
        }
    },
};
