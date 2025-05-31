import { CommandInteraction, ChatInputApplicationCommandData } from 'discord.js';

/**
 * Defines the settings/configuration for each guild/server.
 */
export interface GuildSettings {
    guildName: string;          // Name of the guild/server
    guildId: string;            // Guild ID (string)
    prefix: string;             // Command prefix for the guild
    allowedRoles: string[];     // Array of role IDs allowed to run commands or perform actions

    logChannelId?: string;      // Optional: Channel ID where logs are sent
    welcomeMessage?: string;    // Optional: Custom welcome message text for the guild

    roles?: {
        memberRoleId?: string;    // Optional: Member role ID
        [key: string]: string | undefined;  // Additional dynamic role IDs keyed by string
    };
}

/**
 * Defines the shape of a slash command.
 */
export interface Command {
  data: ChatInputApplicationCommandData;                        // Command data (name, description, options)
  execute: (interaction: CommandInteraction) => Promise<void>;  // Async execute function to handle the command interaction
}
