import { Client, ClientOptions, Collection, CommandInteraction, ChatInputApplicationCommandData } from 'discord.js';
import { GuildSettings } from './types';

/**
 * Interface representing a command with data and an execute function.
 */
export interface Command {
    data: ChatInputApplicationCommandData;
    execute: (interaction: CommandInteraction) => Promise<void>;
}

/**
 * Custom Discord.js client extending the base Client.
 * Includes guild-specific settings and command handling.
 */
class CustomClient extends Client {
    public guildSettings: Collection<string, GuildSettings>;
    public commands: Collection<string, Command>;

    constructor(options: ClientOptions) {
        super(options);
        this.guildSettings = new Collection<string, GuildSettings>();
        this.commands = new Collection<string, Command>();
    }

    /**
     * Retrieves guild settings by guild ID.
     * @param guildId The Discord guild ID.
     * @returns The GuildSettings object or undefined if not found.
     */
    public getGuildSettings(guildId: string): GuildSettings | undefined {
        return this.guildSettings.get(guildId);
    }

    /**
     * Registers commands with Discord API or local collection.
     * (Placeholder method to implement command registration logic.)
     */
    public async registerCommands(): Promise<void> {
        // Implementation to register commands (e.g., with Discord REST API)
        // and populate this.commands collection
    }
}

export default CustomClient;
