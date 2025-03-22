import Database from './database';
import Logger from './logger';
import { Client, Guild, GuildMember } from 'discord.js';

class UserService {
    // Function to check if the user exists and add them if not for each guild
    async ensureUserExists(client: Client, member: GuildMember) {
        try {
            // Check and add the user for each guild the user belongs to
            client.guilds.cache.forEach(async (guild: Guild) => {
                await Database.ensureUserExists(member.id, guild.id, member);
            });
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
