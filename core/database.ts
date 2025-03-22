import { Sequelize, DataTypes, Model, Optional } from 'sequelize';
import fs from 'fs';
import Logger from './logger';

// Read the configuration file for the database
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

// Define the interface for the User attributes
interface UserAttributes {
    discordUserId: string;
    guildId: string;
    username: string;
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
    discordCreation: string;
}

// Define the interface for the Guild settings
interface GuildSettingsAttributes {
    id: string;
    settings: object;
}

// Define the interface for the User creation attributes (what you can create with 'create' or 'upsert')
interface UserCreationAttributes extends Optional<UserAttributes, 'discordUserId'> {}

// Define the interface for Guild creation attributes
interface GuildSettingsCreationAttributes extends Optional<GuildSettingsAttributes, 'id'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
    public discordUserId!: string;
    public guildId!: string;
    public username!: string;
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
    public discordCreation!: string;
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
                dialect: config.database.type,
                logging: (msg) => Logger.info(msg),
            }
        );

        // Define the User model
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
                JoinedAt: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                verifiedStatus: {
                    type: DataTypes.BOOLEAN,
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
                    type: DataTypes.JSONB, // Storing roles as JSON array
                    allowNull: false,
                    defaultValue: [],
                },
                warnings: {
                    type: DataTypes.INTEGER,
                    defaultValue: 0,
                },
                bans: {
                    type: DataTypes.INTEGER,
                    defaultValue: 0,
                },
                lastAction: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                notes: {
                    type: DataTypes.STRING,
                    defaultValue: '',
                },
                ticketIds: {
                    type: DataTypes.JSONB, // Storing ticket IDs as JSON array
                    allowNull: false,
                    defaultValue: [],
                },
                discordCreation: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
            },
            {
                sequelize: this.sequelize,
                tableName: 'users',
                timestamps: false, // You can add `createdAt` and `updatedAt` if needed
            }
        );

        // Define the GuildSettings model
        this.GuildSettings = GuildSettings.init(
            {
                id: {
                    type: DataTypes.STRING,
                    primaryKey: true,
                },
                settings: {
                    type: DataTypes.JSONB, // Storing guild settings as a JSON object
                    allowNull: false,
                    defaultValue: {},
                },
            },
            {
                sequelize: this.sequelize,
                tableName: 'guild_settings',
                timestamps: false, // You can add `createdAt` and `updatedAt` if needed
            }
        );
    }

    // Connect to the appropriate database based on config
    async connect() {
        try {
            if (config.database.type === 'postgres' || config.database.type === 'mysql') {
                await this.sequelize.authenticate();
                await this.User.sync();
                await this.GuildSettings.sync(); // Synchronize the GuildSettings model
                Logger.info('Connected to database and synchronized User and GuildSettings tables.');
            }
        } catch (error) {
            Logger.error(`Database connection error: ${error}`);
        }
    }

    // Fetch a user by Discord ID and Guild ID
    async getUserByDiscordIdAndGuildId(discordUserId: string, guildId: string) {
        return await this.User.findOne({ where: { discordUserId, guildId } });
    }

    // Add a new user to the database
    async addUserToDatabase(newUser: UserAttributes) {
        return await this.User.create(newUser);
    }

    // Check if a user exists by Discord ID and Guild ID, and add them if not
    async ensureUserExists(discordUserId: string, guildId: string, member: any) {
        const existingUser = await this.getUserByDiscordIdAndGuildId(discordUserId, guildId);
        if (!existingUser) {
            const newUser: UserAttributes = {
                discordUserId: member.id,
                guildId,
                username: member.user.username,
                JoinedAt: member.joinedAt?.toISOString() ?? '',
                verifiedStatus: false,
                verificationDate: null,
                lastActive: member.user.lastMessage?.createdAt?.toISOString() ?? member.joinedAt?.toISOString() ?? new Date().toISOString(),
                roles: member.roles.cache.map((role: any) => role.name),
                warnings: 0,
                bans: 0,
                lastAction: null,
                notes: '',
                ticketIds: [],
                discordCreation: member.user.createdAt.toISOString(),
            };

            await this.addUserToDatabase(newUser);
            Logger.info(`Added user ${member.user.tag} to the database for guild ${guildId}.`);
        }
    }

    // Update a user's status or other information in the database
    async updateUserStatus(discordUserId: string, guildId: string, newStatus: Partial<UserAttributes>) {
        return await this.User.update(newStatus, {
            where: { discordUserId, guildId },
        });
    }

    // Fetch all users (optional)
    async getAllUsers() {
        return await this.User.findAll();
    }

    // Fetch all guild settings
    async getAllGuilds() {
        return await this.GuildSettings.findAll();
    }

    // Add a new guild to the database
    async addGuild(guildId: string) {
        return await this.GuildSettings.create({
            id: guildId,
            settings: {}, // Initialize with default settings (empty object)
        });
    }

    // Remove a guild from the database
    async removeGuild(guildId: string) {
        return await this.GuildSettings.destroy({
            where: { id: guildId },
        });
    }
}

export default new Database();
