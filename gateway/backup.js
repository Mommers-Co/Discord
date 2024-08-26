const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const unzipper = require('unzipper');
const { logEvent } = require('../shared/logger');

// Backup directory
const backupDir = path.join(__dirname, '../backups');

// Function to backup channels
async function backupChannels(client) {
    const channelsData = [];
    client.guilds.cache.forEach(guild => {
        guild.channels.cache.forEach(channel => {
            channelsData.push({
                name: channel.name,
                type: channel.type,
                position: channel.position,
                parent: channel.parentId,
                permissionOverwrites: channel.permissionOverwrites.cache.map(overwrite => ({
                    id: overwrite.id,
                    type: overwrite.type,
                    allow: overwrite.allow.bitfield.toString(),
                    deny: overwrite.deny.bitfield.toString(),
                })),
            });
        });
    });
    await fs.writeJson(path.join(backupDir, 'channels.json'), channelsData);
}

// Function to backup roles
async function backupRoles(client) {
    const rolesData = [];
    client.guilds.cache.forEach(guild => {
        guild.roles.cache.forEach(role => {
            rolesData.push({
                name: role.name,
                color: role.color,
                hoist: role.hoist,
                position: role.position,
                permissions: role.permissions.bitfield.toString(),
                mentionable: role.mentionable,
            });
        });
    });
    await fs.writeJson(path.join(backupDir, 'roles.json'), rolesData);
}

// Function to backup messages
async function backupMessages(client) {
    const messagesData = [];
    for (const guild of client.guilds.cache.values()) {
        for (const channel of guild.channels.cache.values()) {
            if (channel.isTextBased()) {
                const fetchedMessages = await channel.messages.fetch({ limit: 100 }); // Adjust limit as needed
                messagesData.push({
                    channelId: channel.id,
                    messages: fetchedMessages.map(msg => ({
                        id: msg.id,
                        content: msg.content,
                        authorId: msg.author.id,
                        timestamp: msg.createdTimestamp,
                    })),
                });
            }
        }
    }
    await fs.writeJson(path.join(backupDir, 'messages.json'), messagesData);
}

// Function to format date and time for backup filenames
function formatTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

// Function to run the full backup
async function runBackup(client) {
    const timestamp = formatTimestamp();
    const tempBackupDir = path.join(backupDir, `temp-backup-${timestamp}`);
    const backupPath = path.join(backupDir, `backup-${timestamp}.zip`);

    // Ensure the temporary backup directory exists
    await fs.ensureDir(tempBackupDir);

    try {
        // Backup each part of the server
        await backupChannels(client);
        await backupRoles(client);
        await backupMessages(client);

        // Move JSON files to the temporary directory
        const files = ['channels.json', 'roles.json', 'messages.json'];
        for (const file of files) {
            const filePath = path.join(backupDir, file);
            if (await fs.pathExists(filePath)) {
                await fs.move(filePath, path.join(tempBackupDir, file));
            }
        }

        // Create a zip file
        const output = fs.createWriteStream(backupPath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // Compression level
        });

        output.on('close', async () => {
            const successMessage = `Backup complete: ${backupPath} (${archive.pointer()} total bytes)`;
            await logEvent(successMessage);
            console.log(successMessage);

            // Clean up temporary backup directory
            await fs.remove(tempBackupDir);
        });

        archive.on('error', async (err) => {
            const errorMessage = `Backup failed: ${err.message}`;
            await logEvent(errorMessage);
            console.log(errorMessage);
            throw err;
        });

        archive.pipe(output);

        // Add all files from the temporary directory to the archive
        archive.directory(tempBackupDir, false);

        await archive.finalize();
    } catch (error) {
        await logEvent(`Error during backup: ${error.message}`);
        console.log(`Error during backup: ${error.message}`);
    }
}

// Function to run a backup without messages
async function runBackupWithoutMessages(client) {
    const timestamp = formatTimestamp();
    const tempBackupDir = path.join(backupDir, `temp-backup-${timestamp}`);
    const backupPath = path.join(backupDir, `backup-no-messages-${timestamp}.zip`);

    // Ensure the temporary backup directory exists
    await fs.ensureDir(tempBackupDir);

    try {
        // Backup each part of the server except messages
        await backupChannels(client);
        await backupRoles(client);
        // No need to backup messages

        // Move JSON files to the temporary directory
        const files = ['channels.json', 'roles.json'];
        for (const file of files) {
            const filePath = path.join(backupDir, file);
            if (await fs.pathExists(filePath)) {
                await fs.move(filePath, path.join(tempBackupDir, file));
            }
        }

        // Create a zip file
        const output = fs.createWriteStream(backupPath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // Compression level
        });

        output.on('close', async () => {
            const successMessage = `Backup complete: ${backupPath} (${archive.pointer()} total bytes)`;
            await logEvent(successMessage);
            console.log(successMessage);

            // Clean up temporary backup directory
            await fs.remove(tempBackupDir);
        });

        archive.on('error', async (err) => {
            const errorMessage = `Backup failed: ${err.message}`;
            await logEvent(errorMessage);
            console.log(errorMessage);
            throw err;
        });

        archive.pipe(output);

        // Add all files from the temporary directory to the archive
        archive.directory(tempBackupDir, false);

        await archive.finalize();
    } catch (error) {
        await logEvent(`Error during backup: ${error.message}`);
        console.log(`Error during backup: ${error.message}`);
    }
}

// Function to restore backup
async function restoreBackup(client, filePath) {
    const extractDir = path.join(backupDir, 'restore');

    try {
        // Ensure the extraction directory exists
        await fs.ensureDir(extractDir);

        // Extract the zip file
        await fs.createReadStream(filePath)
            .pipe(unzipper.Extract({ path: extractDir }))
            .promise();

        // Load and restore data from extracted files
        const channelsData = await fs.readJson(path.join(extractDir, 'channels.json'));
        const rolesData = await fs.readJson(path.join(extractDir, 'roles.json'));
        const messagesData = await fs.readJson(path.join(extractDir, 'messages.json'));

        // Restore channels
        for (const channel of channelsData) {
            if (!channel.name || channel.name.trim() === '') {
                await logEvent(`Skipping channel restore: Missing or empty name for channel ${channel.id}`);
                console.log(`Skipping channel restore: Missing or empty name for channel ${channel.id}`);
                continue;
            }
            const guild = client.guilds.cache.first(); // Assuming the restore process only targets the first guild
            if (guild) {
                try {
                    await guild.channels.create(channel.name, {
                        type: channel.type,
                        position: channel.position,
                        parent: channel.parent,
                        permissionOverwrites: channel.permissionOverwrites.map(overwrite => ({
                            id: overwrite.id,
                            type: overwrite.type,
                            allow: BigInt(overwrite.allow),
                            deny: BigInt(overwrite.deny),
                        })),
                    });
                } catch (err) {
                    await logEvent(`Error creating channel ${channel.name}: ${err.message}`);
                    console.log(`Error creating channel ${channel.name}: ${err.message}`);
                }
            }
        }

        // Restore roles
        for (const role of rolesData) {
            if (!role.name || role.name.trim() === '') {
                await logEvent(`Skipping role restore: Missing or empty name for role ${role.id}`);
                console.log(`Skipping role restore: Missing or empty name for role ${role.id}`);
                continue;
            }
            const guild = client.guilds.cache.first(); // Assuming the restore process only targets the first guild
            if (guild) {
                try {
                    await guild.roles.create({
                        name: role.name,
                        color: role.color,
                        hoist: role.hoist,
                        position: role.position,
                        permissions: BigInt(role.permissions),
                        mentionable: role.mentionable,
                    });
                } catch (err) {
                    await logEvent(`Error creating role ${role.name}: ${err.message}`);
                    console.log(`Error creating role ${role.name}: ${err.message}`);
                }
            }
        }

        // Restore messages if applicable
        for (const channelMessages of messagesData) {
            const channel = client.channels.cache.get(channelMessages.channelId);
            if (channel && channel.isTextBased()) {
                for (const message of channelMessages.messages) {
                    try {
                        await channel.send({
                            content: message.content,
                            // Handle attachments separately if needed
                        });
                    } catch (err) {
                        await logEvent(`Error sending message to channel ${channelMessages.channelId}: ${err.message}`);
                        console.log(`Error sending message to channel ${channelMessages.channelId}: ${err.message}`);
                    }
                }
            }
        }

        // Clean up extracted files
        await fs.remove(extractDir);

        const successMessage = 'Backup restore complete.';
        await logEvent(successMessage);
        console.log(successMessage);
    } catch (error) {
        await logEvent(`Error during restore: ${error.message}`);
        console.log(`Error during restore: ${error.message}`);
        throw error;
    }
}


module.exports = { runBackup, runBackupWithoutMessages, restoreBackup };
