import { Sequelize, DataTypes, Model, Optional } from 'sequelize';
import fs from 'fs';
import Logger from './logger';
import { GuildMember, TextChannel, Message } from 'discord.js';

// Read the configuration file for the database
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

// Define the interface for the User attributes
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
                    type: DataTypes.JSONB,
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
                ]
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
                    type: DataTypes.JSONB,
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

            // Ensure all models are created, including the guild_settings table
            await this.sequelize.sync({ force: false }); // This will create the table if it does not exist
            Logger.info('Tables synchronized successfully');
        } catch (error) {
            Logger.error(`Unable to connect to the database: ${error}`);
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
                return await this.User.create(user);
            } else {
                Logger.info(`User with discordUserId ${user.discordUserId} already exists in guild ${user.guildId}`);
                return existingUser; // Optionally, return the existing user
            }
        } catch (error) {
            Logger.error(`Error adding user to the database: ${error}`);
        }
    }

    public async ensureUserExists(discordUserId: string, guildId: string, member: GuildMember) {
        const existingUser = await this.getUserByDiscordIdAndGuildId(discordUserId, guildId);
        
        if (!existingUser) {
            // Find a valid TextChannel
            const channel = member.guild.channels.cache.find(ch => ch instanceof TextChannel && ch.viewable);
    
            // Declare lastMessage properly
            let lastMessage: Message | null = null;
    
            if (channel && channel instanceof TextChannel) {
                // Fetch all messages from the channel
                const messages = await channel.messages.fetch({ limit: 100 });
    
                // Filter messages to find the one sent by the specific user
                lastMessage = messages.filter(msg => msg.author.id === member.id).first() ?? null;
            }
    
            // Check if the member has the "member" role
            const verifiedStatus = member.roles.cache.some(role => role.name.toLowerCase() === 'member');
    
            // Define the userData object with the required attributes
            const userData: UserAttributes = {
                discordUserId: member.id,
                guildId,
                username: member.user.username,
                JoinedAt: member.joinedAt?.toISOString() ?? '',
                verifiedStatus, // Set the verified status based on whether they have the "member" role
                verificationDate: null,
                lastActive: lastMessage
                    ? new Date(lastMessage.createdAt).toISOString()
                    : member.joinedAt?.toISOString() ?? new Date().toISOString(),
                roles: member.roles.cache.map((role) => role.name),
                warnings: 0,
                bans: 0,
                lastAction: null,
                notes: '',
                ticketIds: [],
                discordCreation: member.user.createdAt.toISOString(),
            };
    
            // Insert the new user into the database
            await this.addUserToDatabase(userData);
        }
    }

    async updateUserStatus(discordUserId: string, guildId: string, newStatus: Partial<UserAttributes>) {
        return await this.User.update(newStatus, {
            where: { discordUserId, guildId },
        });
    }
    
    // Fetch all users
    async getAllUsers() {
        return await this.User.findAll();
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
