import Database from './database';
import Logger from './logger';
import { GuildMember } from 'discord.js';

class UserService {
    // Function to check if the user exists and add them if not
    async ensureUserExists(member: GuildMember) {
        try {
            // Use the method from the Database class to check and add the user if necessary
            await Database.ensureUserExists(member.id, member);
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
