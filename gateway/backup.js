const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const { Client } = require('discord.js');

// Backup directory
const backupDir = path.join(__dirname, 'backups');

// Function to run the backup
async function runBackup(client) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}.zip`);

    // Ensure the backup directory exists
    await fs.ensureDir(backupDir);

    try {
        // Create a zip file
        const output = fs.createWriteStream(backupPath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // Compression level
        });

        output.on('close', () => {
            console.log(`Backup complete: ${backupPath} (${archive.pointer()} total bytes)`);
        });

        archive.on('error', (err) => {
            throw err;
        });

        archive.pipe(output);

        // Add files to the archive (e.g., backup files)
        // Example: Add a file or directory to the archive
        // archive.file('/path/to/file', { name: 'filename' });
        // archive.directory('/path/to/directory', 'directory-name');

        // In this example, assume there's a `data.json` file for backup
        // Replace this with the actual files/directories you want to back up
        archive.directory(path.join(__dirname, 'data'), false);

        await archive.finalize();
    } catch (error) {
        console.error('Error during backup:', error);
    }
}

module.exports = { runBackup };
