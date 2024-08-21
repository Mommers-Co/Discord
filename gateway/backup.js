const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const { EventLog, ConsoleLog } = require('../shared/logger');

// Backup directory
const backupDir = path.join(__dirname, '../backups');

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
            const successMessage = `Backup complete: ${backupPath} (${archive.pointer()} total bytes)`;
            EventLog(successMessage);
            console.log(successMessage);
        });

        archive.on('error', (err) => {
            const errorMessage = `Backup failed: ${err.message}`;
            EventLog(errorMessage);
            console.log(errorMessage);
            throw err;
        });

        archive.pipe(output);

        archive.directory(path.join(__dirname, 'data'), false);

        await archive.finalize();
    } catch (error) {
        EventLog(`Error during backup: ${error.message}`);
        console.log(`Error during backup: ${error.message}`);
    }
}

module.exports = { runBackup };
