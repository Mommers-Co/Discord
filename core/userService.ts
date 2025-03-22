import Database from './database';
import Logger from './logger';
import { Client, GuildMember } from 'discord.js';

class UserService {
    // Function to check if the user exists and add them if not
    async ensureUserExists(member: GuildMember) {
        try {
            const existingUser = await Database.checkExistingUser(member.id);

            if (!existingUser) {
                // Create the user object to store in the database
                const newUser = {
                    discordUserId: member.id,
                    username: member.user.username,
                    JoinedAt: member.joinedAt?.toISOString() ?? '',
                    verifiedStatus: false,
                    verificationDate: null,
                    lastActive: member.user.lastMessage?.createdAt?.toISOString() ?? member.joinedAt?.toISOString() ?? new Date().toISOString(),
                    roles: member.roles.cache.map((role) => role.name),
                    warnings: 0,
                    bans: 0,
                    lastAction: null,
                    notes: '',
                    ticketIds: [],
                    discordCreation: member.user.createdAt.toISOString(),
                };

                // Add the new user to the database
                await Database.addUserToDatabase(newUser);
                Logger.info(`Added user ${member.user.tag} (ID: ${member.id}) to the database.`);
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
