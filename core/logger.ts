import fs from "fs";
import path from "path";

// Define log file path
const logFilePath = path.join(__dirname, "../logs/bot.log");

// Ensure logs directory exists
if (!fs.existsSync(path.dirname(logFilePath))) {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
}

class Logger {
    // Static log method
    static log(level: "INFO" | "WARN" | "ERROR", message: string) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] ${message}\n`;

        // Print to console
        console.log(logMessage.trim()); 

        // Write to file
        fs.appendFileSync(logFilePath, logMessage);
    }

    // Static helper methods
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
