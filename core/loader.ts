import { Client, CommandInteraction } from "discord.js";
import { readdirSync, statSync, existsSync } from "fs";
import { join } from "path";
import Logger from "./logger";
import CustomClient from './customClient';  // Import CustomClient for commands property

// Dynamically load modules and their commands from the "modules" directory
export const loadModules = async (client: CustomClient) => {
    const modulesPath = join(__dirname, "../modules");
    const moduleFolders = readdirSync(modulesPath).filter(folder => {
        const folderPath = join(modulesPath, folder);
        return statSync(folderPath).isDirectory();
    });

    Logger.info(`Loading modules from ${moduleFolders.length} folder(s)...`);

    for (const folder of moduleFolders) {
        const folderPath = join(modulesPath, folder);

        try {
        // Import the module's main file, assumed to be named the same as folder (e.g. 'modules/modulename/modulename.ts')
        const modulePath = join(folderPath, `${folder}.ts`);
        const module = await import(modulePath);

        if (module.default && typeof module.default === 'function') {
            await module.default(client);
            Logger.info(`Successfully loaded module: ${folder}`);
        } else {
            Logger.warn(`Module ${folder} does not export a default function`);
        }

        // Load commands from a 'commands' subfolder inside the module folder
        const commandFolderPath = join(folderPath, "commands");
        if (existsSync(commandFolderPath) && statSync(commandFolderPath).isDirectory()) {
            const commandFiles = readdirSync(commandFolderPath).filter(file => file.endsWith('.ts'));

            for (const file of commandFiles) {
            try {
                const commandPath = join(commandFolderPath, file);
                const commandModule = await import(commandPath);

                // Support either an exported 'commands' array or a single 'command' export (common patterns)
                if (commandModule.commands && Array.isArray(commandModule.commands)) {
                for (const command of commandModule.commands) {
                    if (command.data && command.data.name) {
                    client.commands.set(command.data.name, command);
                    Logger.info(`Registered command: ${command.data.name}`);
                    } else {
                    Logger.warn(`Command in ${file} does not have valid data.`);
                    }
                }
                } else if (commandModule.command) {
                const command = commandModule.command;
                if (command.data && command.data.name) {
                    client.commands.set(command.data.name, command);
                    Logger.info(`Registered command: ${command.data.name}`);
                } else {
                    Logger.warn(`Command in ${file} does not have valid data.`);
                }
                } else {
                Logger.warn(`No commands exported in ${file}`);
                }
            } catch (commandError: unknown) {
                if (commandError instanceof Error) {
                Logger.error(`Failed to load command ${file}: ${commandError.message}`);
                } else {
                Logger.error(`Failed to load command ${file}: Unknown error`);
                }
            }
            }
        }
        } catch (error: unknown) {
        if (error instanceof Error) {
            Logger.error(`Failed to load module folder ${folder}: ${error.message}`);
        } else {
            Logger.error(`Failed to load module folder ${folder}: Unknown error`);
        }
        }
    }

    Logger.info(`Finished loading modules.`);
    };

    // Handles execution of slash commands when interaction occurs
    export const handleCommandExecution = async (interaction: CommandInteraction, client: CustomClient) => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) {
        Logger.warn(`Command not found: ${interaction.commandName}`);
        return;
    }

    try {
        Logger.info(`Executing command: ${interaction.commandName} in guild ${interaction.guildId}`);
        await command.execute(interaction);
    } catch (error: unknown) {
        if (error instanceof Error) {
        Logger.error(`Error executing command ${interaction.commandName}: ${error.message}`);
        } else {
        Logger.error(`Error executing command ${interaction.commandName}: Unknown error`);
        }
    }
};
