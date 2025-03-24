import { Client, ClientOptions, Collection, CommandInteraction } from 'discord.js';
import { GuildSettings } from './types';

// Define a custom Command type
interface Command {
    data: {
        name: string;
        description: string;
    };
    execute: (interaction: CommandInteraction) => Promise<void>;
}

// Extend the Client class with custom properties
class CustomClient extends Client {
    guildSettings: Collection<string, GuildSettings>;  // For storing guild settings by ID
    commands: Collection<string, Command>;   // For storing commands by name

    constructor(options: ClientOptions) {
        super(options);
        this.guildSettings = new Collection<string, GuildSettings>();   // Initialize guildSettings as a Collection
        this.commands = new Collection<string, Command>();        // Initialize commands as a Collection
    }
}

export default CustomClient;
