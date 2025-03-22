import { Client, CommandInteraction } from "discord.js";
import { readdirSync, statSync } from "fs";
import { join } from "path";
import Logger from "./logger";
import CustomClient from './customClient';  // Import CustomClient to ensure commands property is available

// Function to dynamically load modules and commands from the "modules" directory
export const loadModules = async (client: CustomClient) => {
    const modulesPath = join(__dirname, "../modules");
    const moduleFolders = readdirSync(modulesPath).filter((folder) => statSync(join(modulesPath, folder)).isDirectory()); // Get all folders in modules

    Logger.info(`Loading modules from ${moduleFolders.length} folder(s)...`);

    // Loop through all module folders
    for (const folder of moduleFolders) {
        const folderPath = join(modulesPath, folder);

        try {
            // dynamically import the module's main file (e.g., default export)
            const modulePath = join(folderPath, `${folder}.ts`);
            const module = await import(modulePath); // Dynamically import the module file

            // Check if the module exports a default function (assumed to be the entry point of the module)
            if (module.default) {
                await module.default(client);
                Logger.info(`Successfully loaded module: ${folder}`);
            } else {
                Logger.warn(`Module ${folder} does not export a default function`);
            }

            // check if there's a subfolder named 'commands' to load command files
            const commandFolderPath = join(folderPath, "commands");
            if (statSync(commandFolderPath).isDirectory()) {
                const commandFiles = readdirSync(commandFolderPath).filter((file) => file.endsWith('.ts')); // Filter for TypeScript command files

                // Loop through all command files in the 'commands' subfolder
                for (const file of commandFiles) {
                    try {
                        const commandPath = join(commandFolderPath, file);
                        const commandModule = await import(commandPath); // Dynamically import the command

                        // Register the command if it exports a command object with valid data
                        if (commandModule.commands) {
                            for (const command of commandModule.commands) {
                                if (command.data) {
                                    client.commands.set(command.data.name, command);
                                    Logger.info(`Registered command: ${command.data.name}`);
                                } else {
                                    Logger.warn(`Command in ${file} does not have valid data.`);
                                }
                            }
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

// Function to handle command execution (this will be called when an interaction occurs)
export const handleCommandExecution = async (interaction: CommandInteraction, client: CustomClient) => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (command) {
        try {
            Logger.info(`Executing command: ${interaction.commandName} in guild ${interaction.guildId}`);
            await command.execute(interaction); // Execute the command
        } catch (error: unknown) {
            if (error instanceof Error) {
                Logger.error(`Error executing command ${interaction.commandName}: ${error.message}`);
            } else {
                Logger.error(`Error executing command ${interaction.commandName}: Unknown error`);
            }
        }
    } else {
        Logger.warn(`Command not found: ${interaction.commandName}`);
    }
};
