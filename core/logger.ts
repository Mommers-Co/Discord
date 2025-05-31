import fs from 'fs';
import path from 'path';
import { Client, TextChannel, EmbedBuilder } from 'discord.js';

const configPath = path.resolve(__dirname, '../config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Define log file paths
const logFilePath = path.join(__dirname, '../logs/bot.log');
const dbLogFilePath = path.join(__dirname, '../logs/database.log');

// Ensure logs directory exists
if (!fs.existsSync(path.dirname(logFilePath))) {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
}

enum LogLevel {
    DATA = 'DATA',
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
}

class Logger {
    private static client: Client | null = null;
    private static guildLogChannels: Map<string, TextChannel> = new Map();

    // You can also override this logLevel dynamically if you want
    static logLevel: string = config.logging?.level?.toLowerCase() || 'info';

    public static setClient(client: Client) {
        this.client = client;
    }

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
            data: -1,
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
        };
        return levels[level.toLowerCase()] ?? 0;
    }

    private static shouldLog(level: string): boolean {
        const env = config.environment;  // no default fallback
        const lvl = level.toLowerCase();

        if (env === 'production') {
            // In production, only log INFO and ERROR
            return lvl === 'info' || lvl === 'error';
        } else if (env === 'development') {
            // In development, log based on configured logLevel priority
            return this.levelPriority(lvl) >= this.levelPriority(Logger.logLevel);
        } else {
            // If environment is undefined or any other value, choose your behavior:
            // Here, I return false (no logging)
            return false;
        }
    }

    private static getFormattedTimestamp(): string {
        const now = new Date();
        return now.toLocaleString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }).replace(',', ' |');
    }

    private static async sendToDiscord(level: LogLevel, message: string, guildId?: string) {
        if (!this.client || !message) return;
        if (!this.client.isReady?.()) return;

        let channel: TextChannel | undefined;

        if (guildId) {
            channel = this.guildLogChannels.get(guildId);
        }

        if (!channel && guildId && config.discord.guilds?.[guildId]?.channels?.logChannelId) {
            const defaultChannelId = config.discord.guilds[guildId].channels.logChannelId;
            const defaultChannel = this.client.channels.cache.get(defaultChannelId);
            if (defaultChannel?.isTextBased()) {
                channel = defaultChannel as TextChannel;
            }
        }

        if (!channel && config.discord.logChannelId) {
            const globalChannel = this.client.channels.cache.get(config.discord.logChannelId);
            if (globalChannel?.isTextBased()) {
                channel = globalChannel as TextChannel;
            }
        }

        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle(`[${level}]`)
            .setDescription(message.length > 4096 ? message.slice(0, 4093) + '...' : message)
            .setColor(
                level === LogLevel.ERROR ? 0xFF0000 :
                level === LogLevel.WARN ? 0xFFA500 :
                level === LogLevel.DEBUG ? 0x808080 :
                level === LogLevel.DATA ? 0x00FFFF :
                0x00BFFF
            )
            .setTimestamp();

        try {
            await channel.send({ embeds: [embed] });
        } catch (err) {
            console.error('[Logger] Failed to send log to Discord:', err);
        }
    }

    static async log(level: LogLevel, message: string, isDatabaseLog = false, guildId?: string) {
        if (!message || !this.shouldLog(level.toLowerCase())) return;

        const timestamp = this.getFormattedTimestamp();
        const logMessage = `[${timestamp}] [${level}] ${message}\n`;

        try {
            if (isDatabaseLog) {
                fs.appendFileSync(dbLogFilePath, logMessage);
            } else {
                fs.appendFileSync(logFilePath, logMessage);
            }
        } catch (e) {
            console.error('[Logger] Failed to write log to file:', e);
        }

        switch (level) {
            case LogLevel.DEBUG:
                if (this.logLevel === 'debug') console.debug(logMessage.trim());
                break;
            case LogLevel.INFO:
                console.log(logMessage.trim());
                break;
            case LogLevel.WARN:
                console.warn(logMessage.trim());
                break;
            case LogLevel.ERROR:
                console.error(logMessage.trim());
                break;
        }

        await this.sendToDiscord(level, message, guildId);
    }

    static database(message: string, guildId?: string) {
        this.log(LogLevel.DATA, message, true, guildId);
    }

    static info(message: string, guildId?: string) {
        this.log(LogLevel.INFO, message, false, guildId);
    }

    static warn(message: string, guildId?: string) {
        this.log(LogLevel.WARN, message, false, guildId);
    }

    static error(message: string, guildId?: string) {
        this.log(LogLevel.ERROR, message, false, guildId);
    }

    static debug(message: string, guildId?: string) {
        this.log(LogLevel.DEBUG, message, false, guildId);
    }

    static data(message: string, guildId?: string) {
        this.log(LogLevel.DATA, message, false, guildId);
    }
}

export default Logger;
