import { Sequelize, DataTypes, Model, Optional } from 'sequelize';
import fs from 'fs';
import Logger from './logger';
import { GuildMember, TextChannel, Message } from 'discord.js';

const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

// Interfaces
interface UserAttributes {
    discordUserId: string;
    guildId: string;
    username: string;
    discordCreation: string;
    JoinedAt: string;
    verifiedStatus: boolean;
    verificationDate: string | null;
    lastActive: string;
    roles: string[];
    warnings: number;
    bans: number;
    lastAction: string | null;
    notes: string;
    ticketIds: string[];
}

interface GuildSettingsAttributes {
    id: string;
    settings: object;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'discordUserId'> {}
interface GuildSettingsCreationAttributes extends Optional<GuildSettingsAttributes, 'id'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
    public discordUserId!: string;
    public guildId!: string;
    public username!: string;
    public discordCreation!: string;
    public JoinedAt!: string;
    public verifiedStatus!: boolean;
    public verificationDate!: string | null;
    public lastActive!: string;
    public roles!: string[];
    public warnings!: number;
    public bans!: number;
    public lastAction!: string | null;
    public notes!: string;
    public ticketIds!: string[];
}

class GuildSettings extends Model<GuildSettingsAttributes, GuildSettingsCreationAttributes> implements GuildSettingsAttributes {
    public id!: string;
    public settings!: object;
}

class Database {
    private sequelize: Sequelize;
    private User: typeof User;
    private GuildSettings: typeof GuildSettings;

    constructor() {
        this.sequelize = new Sequelize(
            config.database.name,
            config.database.user,
            config.database.password,
            {
                host: config.database.host,
                dialect: config.database.type as any,
                logging: (sql, timing) => Logger.database(`${sql}${timing ? ` (${timing} ms)` : ''}`),

                dialectOptions: {
                    ssl: {
                        require: true,
                        rejectedUnauthorized: false
                    }
                }
            }
        );


        this.User = User.init(
            {
                discordUserId: {
                    type: DataTypes.STRING,
                    primaryKey: true,
                },
                guildId: {
                    type: DataTypes.STRING,
                    primaryKey: true,
                },
                username: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                discordCreation: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                JoinedAt: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                verifiedStatus: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                },
                verificationDate: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                lastActive: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                roles: {
                    type: DataTypes.JSONB || DataTypes.JSON,
                    allowNull: false,
                    defaultValue: [],
                },
                warnings: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    defaultValue: 0,
                },
                bans: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    defaultValue: 0,
                },
                lastAction: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                notes: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    defaultValue: '',
                },
                ticketIds: {
                    type: DataTypes.JSONB || DataTypes.JSON,
                    allowNull: false,
                    defaultValue: [],
                },
            },
            {
                sequelize: this.sequelize,
                modelName: 'User',
                tableName: 'users',
                timestamps: false,
                indexes: [
                    {
                        unique: true,
                        fields: ['discordUserId', 'guildId'],
                    },
                ],
            }
        );

        this.GuildSettings = GuildSettings.init(
            {
                id: {
                    type: DataTypes.STRING,
                    primaryKey: true,
                },
                settings: {
                    type: DataTypes.JSONB || DataTypes.JSON,
                    allowNull: false,
                    defaultValue: {},
                },
            },
            {
                sequelize: this.sequelize,
                modelName: 'GuildSettings',
                tableName: 'guild_settings',
                timestamps: false,
            }
        );
    }

    public async connect() {
        try {
            await this.sequelize.authenticate();
            Logger.info('Connected to the database');
            await this.sequelize.sync({ force: false });
            Logger.info('Tables synchronized successfully');
        } catch (error) {
            Logger.error(`Database connection error: ${error}`);
        }
    }

    public async ensureGuildExists(guildId: string) {
        try {
            const existingGuild = await this.GuildSettings.findOne({ where: { id: guildId } });
            if (!existingGuild) {
                Logger.data(`[DB] Guild config missing for ID: ${guildId}. Creating default config.`);
                await this.addGuild(guildId);
                Logger.data(`[DB] Guild config created for ID: ${guildId}`);
            }
        } catch (error) {
            Logger.error(`[DB] Failed to ensure guild exists (${guildId}): ${error}`);
        }
    }

    public async getAllGuilds() {
        return await this.GuildSettings.findAll();
    }

    public async getUserByDiscordIdAndGuildId(discordUserId: string, guildId: string) {
        return await this.User.findOne({
            where: { discordUserId, guildId },
        });
    }

    public async addUserToDatabase(user: UserAttributes) {
        try {
            const existingUser = await this.getUserByDiscordIdAndGuildId(user.discordUserId, user.guildId);
            if (!existingUser) {
                const newUser = await this.User.create(user);
                Logger.data(`[DB] Added user ${user.discordUserId} to guild ${user.guildId}`);
                return newUser;
            } else {
                Logger.data(`[DB] User ${user.discordUserId} already exists in guild ${user.guildId}`);
                return existingUser;
            }
        } catch (error) {
            Logger.error(`[DB] Error adding user: ${error}`);
            throw error;
        }
    }

    public async ensureUserExists(discordUserId: string, guildId: string, member: GuildMember) {
        const existingUser = await this.getUserByDiscordIdAndGuildId(discordUserId, guildId);
        if (existingUser) return;

        const channel = member.guild.channels.cache.find(
            ch => ch instanceof TextChannel && ch.viewable
        ) as TextChannel | undefined;

        let lastMessage: Message | null = null;

        if (channel) {
            const messages = await channel.messages.fetch({ limit: 100 });
            lastMessage = messages.find(msg => msg.author.id === member.id) ?? null;
        }

        const verifiedStatus = member.roles.cache.some(
            role => role.name.toLowerCase() === 'member'
        );

        const userData: UserAttributes = {
            discordUserId: member.id,
            guildId,
            username: member.user.username,
            discordCreation: member.user.createdAt.toISOString(),
            JoinedAt: member.joinedAt?.toISOString() ?? new Date().toISOString(),
            verifiedStatus,
            verificationDate: null,
            lastActive: lastMessage?.createdAt.toISOString() ?? member.joinedAt?.toISOString() ?? new Date().toISOString(),
            roles: member.roles.cache.map(role => role.name),
            warnings: 0,
            bans: 0,
            lastAction: null,
            notes: '',
            ticketIds: [],
        };

        await this.addUserToDatabase(userData);
    }

    public async updateUserStatus(discordUserId: string, guildId: string, newStatus: Partial<UserAttributes>) {
        try {
            const result = await this.User.update(newStatus, {
                where: { discordUserId, guildId },
            });
            Logger.data(`[DB] Updated user status for ${discordUserId} in guild ${guildId}`);
            return result;
        } catch (error) {
            Logger.error(`[DB] Failed to update user status: ${error}`);
            throw error;
        }
    }

    public async getAllUsers() {
        return await this.User.findAll();
    }

    public async addGuild(guildId: string) {
        try {
            const newGuild = await this.GuildSettings.create({
                id: guildId,
                settings: {},
            });
            Logger.data(`[DB] Guild config created for ID: ${guildId}`);
            return newGuild;
        } catch (error) {
            Logger.error(`[DB] Failed to create guild config for ID: ${guildId}: ${error}`);
            throw error;
        }
    }

    public async removeGuild(guildId: string) {
        try {
            const deletedCount = await this.GuildSettings.destroy({
                where: { id: guildId },
            });
            Logger.data(`[DB] Removed guild config for ID: ${guildId}`);
            return deletedCount;
        } catch (error) {
            Logger.error(`[DB] Failed to remove guild config for ID: ${guildId}: ${error}`);
            throw error;
        }
    }
}

export default new Database();
