import fs from 'fs';
import path from 'path';

// Config file path
const configPath = path.resolve(__dirname, '../config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Define log file paths
const logFilePath = path.join(__dirname, "../logs/bot.log");
const dbLogFilePath = path.join(__dirname, "../logs/database.log");

// Ensure logs directory exists
if (!fs.existsSync(path.dirname(logFilePath))) {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
}

class Logger {
    // Log level from config
    static logLevel: string = config.logging.level || 'debug'; // Default to 'debug' if not set in config

    // Helper method to compare the log level
    private static shouldLog(level: string): boolean {
        const levels: { [key: string]: number } = {
            'debug': 0,
            'info': 1,
            'warn': 2,
            'error': 3,
        };

        return levels[level] >= levels[Logger.logLevel];
    }

    // Format current date/time as DD/MM/YYYY | HH:mm:ss (local time)
    private static getFormattedTimestamp(): string {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
        const year = now.getFullYear();

        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        return `${day}/${month}/${year} | ${hours}:${minutes}:${seconds}`;
    }

    // Static log method for general logging
    static log(level: "INFO" | "WARN" | "ERROR", message: string, isDatabaseLog: boolean = false) {
        const timestamp = Logger.getFormattedTimestamp();
        const logMessage = `[${timestamp}] [${level}] ${message}\n`;

        // Log to console based on log level
        if (Logger.shouldLog(level.toLowerCase())) {
            if (level === 'INFO' && Logger.logLevel !== 'error') {
                console.log(logMessage.trim());
            } else if (level === 'WARN' && (Logger.logLevel === 'debug' || Logger.logLevel === 'info')) {
                console.warn(logMessage.trim());
            } else if (level === 'ERROR') {
                console.error(logMessage.trim());
            }
        }

        // Write to appropriate file
        if (isDatabaseLog) {
            // Log to database.log
            fs.appendFileSync(dbLogFilePath, logMessage);
        } else {
            // Log to bot.log
            fs.appendFileSync(logFilePath, logMessage);
        }
    }

    // Helper method for logging database-specific events
    static database(message: string) {
        this.log("INFO", message, true); // Pass true to log to database.log
    }

    // Static helper methods for different log levels
    static info(message: string) {
        this.log("INFO", message);
    }

    static warn(message: string) {
        this.log("WARN", message);
    }

    static error(message: string) {
        this.log("ERROR", message);
    }
}

export default Logger;
