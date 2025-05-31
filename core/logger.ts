import fs from 'fs';
import path from 'path';
import { Client, TextChannel, EmbedBuilder } from 'discord.js';

// Config file path
const configPath = path.resolve(__dirname, '../config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Define log file paths
const logFilePath = path.join(__dirname, '../logs/bot.log');
const dbLogFilePath = path.join(__dirname, '../logs/database.log');

// Ensure logs directory exists
if (!fs.existsSync(path.dirname(logFilePath))) {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
}

class Logger {
    private static client: Client | null = null;
    private static guildLogChannels: Map<string, TextChannel> = new Map();

    static logLevel: string = config.logging?.level?.toLowerCase() || 'debug';

    public static setClient(client: Client) {
        this.client = client;
    }

    /**
     * Initialize guild log channels map from your guild settings map
     */
    public static setGuildLogChannels(guildSettings: Map<string, any>) {
        if (!this.client) {
            console.warn('[Logger] Client not set before setting guild log channels');
            return;
        }

        this.guildLogChannels.clear();

        for (const [guildId, settings] of guildSettings) {
            const channelId = settings.logChannelId;
            if (!channelId) {
                console.warn(`[Logger] No logChannelId for guild ${guildId}`);
                continue;
            }
            const channel = this.client.channels.cache.get(channelId);
            if (channel && channel.isTextBased()) {
                this.guildLogChannels.set(guildId, channel as TextChannel);
            } else {
                console.warn(`[Logger] Could not find text channel ${channelId} for guild ${guildId}`);
            }
        }
    }

    private static levelPriority(level: string): number {
        const levels: Record<string, number> = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
        };
        return levels[level.toLowerCase()] ?? 0;
    }

    private static shouldLog(level: string): boolean {
        return this.levelPriority(level) >= this.levelPriority(Logger.logLevel);
    }

    private static getFormattedTimestamp(): string {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${day}/${month}/${year} | ${hours}:${minutes}:${seconds}`;
    }

    private static async sendToDiscord(level: "INFO" | "WARN" | "ERROR", message: string, guildId?: string) {
        if (!this.client) return;

        let channel: TextChannel | undefined;

        if (guildId) {
            channel = this.guildLogChannels.get(guildId);
        }

        // Fallback: try default guild channel if no guild channel found
        if (!channel && guildId && config.discord.guilds?.[guildId]?.channels?.logChannelId) {
            const defaultChannelId = config.discord.guilds[guildId].channels.logChannelId;
            const defaultChannel = this.client.channels.cache.get(defaultChannelId);
            if (defaultChannel && defaultChannel.isTextBased()) {
                channel = defaultChannel as TextChannel;
            }
        }

        // Final fallback: global logChannelId if set
        if (!channel && config.discord.logChannelId) {
            const globalChannel = this.client.channels.cache.get(config.discord.logChannelId);
            if (globalChannel && globalChannel.isTextBased()) {
                channel = globalChannel as TextChannel;
            }
        }

        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle(`[${level}]`)
            .setDescription(message.length > 4096 ? message.slice(0, 4093) + '...' : message)
            .setColor(
                level === "ERROR" ? 0xFF0000 :
                level === "WARN" ? 0xFFA500 :
                0x00BFFF
            )
            .setTimestamp();

        try {
            await channel.send({ embeds: [embed] });
        } catch (err) {
            console.error(`[Logger] Failed to send log to Discord:`, err);
        }
    }

    /**
     * Main log function
     * @param level Log level
     * @param message Log message
     * @param isDatabaseLog Write to database log file if true
     * @param guildId Optional guild id to send log message in Discord channel
     */
    static async log(level: "INFO" | "WARN" | "ERROR", message: string, isDatabaseLog = false, guildId?: string) {
        if (!this.shouldLog(level.toLowerCase())) return;

        const timestamp = this.getFormattedTimestamp();
        const logMessage = `[${timestamp}] [${level}] ${message}\n`;

        // Console output
        if (level === 'INFO' && this.logLevel !== 'error') {
            console.log(logMessage.trim());
        } else if (level === 'WARN') {
            console.warn(logMessage.trim());
        } else if (level === 'ERROR') {
            console.error(logMessage.trim());
        }

        // Write to file (catch errors to avoid crash)
        try {
            if (isDatabaseLog) {
                fs.appendFileSync(dbLogFilePath, logMessage);
            } else {
                fs.appendFileSync(logFilePath, logMessage);
            }
        } catch (e) {
            console.error('[Logger] Failed to write log to file:', e);
        }

        // Send to Discord (await to avoid unhandled promises)
        await this.sendToDiscord(level, message, guildId);
    }

    static database(message: string, guildId?: string) {
        this.log("INFO", message, true, guildId);
    }

    static info(message: string, guildId?: string) {
        this.log("INFO", message, false, guildId);
    }

    static warn(message: string, guildId?: string) {
        this.log("WARN", message, false, guildId);
    }

    static error(message: string, guildId?: string) {
        this.log("ERROR", message, false, guildId);
    }
}

export default Logger;
