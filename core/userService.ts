import Database from './database';
import Logger from './logger';
import { Client, Guild, GuildMember } from 'discord.js';

class UserService {
    // Function to check if the user exists and add them if not for each guild
    async ensureUserExists(client: Client, member: GuildMember) {
        try {
            // Track if the user was added to any guild
            let userAdded = false;

            // Iterate over each guild the bot is part of and check if the user should be added
            await Promise.all(
                client.guilds.cache.map(async (guild: Guild) => {
                    // Check if the user is part of this guild
                    if (guild.members.cache.has(member.id)) {
                        // Check if the user already exists in the database for this guild
                        const user = await Database.getUserByDiscordId(member.id, guild.id);

                        if (user) {
                            // If the user is already in the database, log it
                            Logger.info(`User ${member.user.tag} already exists in database for guild ${guild.name}.`);
                        } else {
                            // If the user doesn't exist, add them to the database
                            await Database.ensureUserExists(member.id, guild.id, member);
                            userAdded = true;
                            Logger.info(`User ${member.user.tag} added to the database for guild ${guild.name}.`);
                        }
                    } else {
                        // If the user is not in the guild, log that they're skipped for this guild
                        Logger.info(`User ${member.user.tag} is not a member of guild ${guild.name}, skipping database check.`);
                    }
                })
            );

            // Log the result of whether the user was added to the database
            if (userAdded) {
                Logger.info(`User ${member.user.tag} was successfully processed and added to the database where applicable.`);
            } else {
                Logger.info(`No new user entries for ${member.user.tag}; already in the database for all relevant guilds.`);
            }

        } catch (error: unknown) {
            if (error instanceof Error) {
                Logger.error(`Error checking or adding user ${member.user.tag}: ${error.message}`);
            } else {
                Logger.error(`Unknown error when processing user ${member.user.tag}: ${String(error)}`);
            }
        }
    }
}

export default new UserService();
