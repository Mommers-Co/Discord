import fs from 'fs';
import path from 'path';

//config file path
const configPath = path.resolve(__dirname, '../config.json');
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

// Define log file path
const logFilePath = path.join(__dirname, "../logs/bot.log");

// Ensure logs directory exists
if (!fs.existsSync(path.dirname(logFilePath))) {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
}

class Logger {
    // Log level from config
    static logLevel: string = config.logging.level || 'debug';  // Default to 'debug' if not set in config

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

    // Static log method
    static log(level: "INFO" | "WARN" | "ERROR", message: string) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] ${message}\n`;

        // Only log based on the configured level
        if (Logger.shouldLog(level.toLowerCase())) {
            // Print to console
            if (level === 'INFO' && Logger.logLevel !== 'error') {
                console.log(logMessage.trim());
            } else if (level === 'WARN' && (Logger.logLevel === 'debug' || Logger.logLevel === 'info')) {
                console.warn(logMessage.trim());
            } else if (level === 'ERROR') {
                console.error(logMessage.trim());
            }

            // Write to file
            fs.appendFileSync(logFilePath, logMessage);
        }
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
