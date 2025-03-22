import { Client, ClientOptions, Collection, CommandInteraction } from 'discord.js';

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
    guildSettings: Collection<string, any>;  // For storing guild settings by ID
    commands: Collection<string, Command>;   // For storing commands by name

    constructor(options: ClientOptions) {
        super(options); 
        this.guildSettings = new Collection();   // Initialize guildSettings as a Collection
        this.commands = new Collection();        // Initialize commands as a Collection
    }
}

export default CustomClient;
