import { CommandInteraction } from "discord.js";

// Defines the settings of each guild
export interface GuildSettings {
    guildId: string; 
    prefix: string;
    allowedRoles: string[];
    logChannelId?: string;
    welcomeMessage?: string;
}

export interface command {
    data: {
        name: string;
        description: string;
    };
    execute: (interaction: CommandInteraction) => Promise<void>;
}
