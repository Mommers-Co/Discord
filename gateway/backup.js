const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const { logEvent } = require('../shared/logger');

// Backup directory
const backupDir = path.join(__dirname, '../backups');

// Function to backup channels
async function backupChannels(client) {
    const channelsData = client.guilds.cache.map(guild => {
        return guild.channels.cache.map(channel => {
            return {
                id: channel.id,
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
            };
        });
    });
    await fs.writeJson(path.join(backupDir, 'channels.json'), channelsData);
}

// Function to backup roles
async function backupRoles(client) {
    const rolesData = client.guilds.cache.map(guild => {
        return guild.roles.cache.map(role => {
            return {
                id: role.id,
                name: role.name,
                color: role.color,
                hoist: role.hoist,
                position: role.position,
                permissions: role.permissions.bitfield.toString(),
                mentionable: role.mentionable,
            };
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

// Function to backup audit logs
async function backupAuditLogs(client) {
    const auditLogsData = client.guilds.cache.map(async guild => {
        const fetchedLogs = await guild.fetchAuditLogs({ limit: 100 }); // Adjust limit as needed
        return {
            guildId: guild.id,
            logs: fetchedLogs.entries.map(entry => ({
                id: entry.id,
                action: entry.action,
                executorId: entry.executor.id,
                targetId: entry.target ? entry.target.id : null,
                changes: entry.changes,
                reason: entry.reason,
            })),
        };
    });
    await fs.writeJson(path.join(backupDir, 'auditLogs.json'), await Promise.all(auditLogsData));
}

// Function to run the backup
async function runBackup(client) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tempBackupDir = path.join(backupDir, `temp-backup-${timestamp}`);
    const backupPath = path.join(backupDir, `backup-${timestamp}.zip`);

    // Ensure the temporary backup directory exists
    await fs.ensureDir(tempBackupDir);

    try {
        // Backup each part of the server
        await backupChannels(client);
        await backupRoles(client);
        await backupMessages(client);
        await backupAuditLogs(client);

        // Move JSON files to the temporary directory
        const files = ['channels.json', 'roles.json', 'messages.json', 'auditLogs.json'];
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
            logEvent(successMessage);
            console.log(successMessage);

            // Clean up temporary backup directory
            await fs.remove(tempBackupDir);
        });

        archive.on('error', (err) => {
            const errorMessage = `Backup failed: ${err.message}`;
            logEvent(errorMessage);
            console.log(errorMessage);
            throw err;
        });

        archive.pipe(output);

        // Add all files from the temporary directory to the archive
        archive.directory(tempBackupDir, false);

        await archive.finalize();
    } catch (error) {
        logEvent(`Error during backup: ${error.message}`);
        console.log(`Error during backup: ${error.message}`);
    }
}

module.exports = { runBackup };
