import { Client, GuildMember, EmbedBuilder } from 'discord.js';
import Logger from './logger';
import { getUserByDiscordId, addUserToDatabase, updateUserStatus } from './database';
import config from '../config.json'; // Import config file

// Function to handle new member joining the server
export const handleNewMemberJoin = async (client: Client, member: GuildMember) => {
    // Dynamically get the guild configuration from config.json using the guild ID
    const guildConfig = Object.values(config.discord).find(guild => guild.guildId === member.guild.id);

    // Check if the configuration for the guild exists
    if (!guildConfig) {
        Logger.error('Guild Configuration Missing', { guildId: member.guild.id });
        return;
    }

    Logger.info('New Member Joined', { user: member.user.tag, userId: member.id, guild: member.guild.name });

    try {
        // Check if the user already exists in the database for this specific guild
        const user = await getUserByDiscordId(member.id, member.guild.id);

        // If the user is not in the database for the current guild, add them
        if (!user) {
            const newUser = {
                discordUserId: member.id,
                guildId: member.guild.id,
                username: member.user.tag,
                discordCreation: member.user.createdAt.toISOString(),
                JoinedAt: new Date().toISOString(),
                verifiedStatus: false,
                verificationDate: null,
                lastActive: new Date().toISOString(),
                roles: member.roles.cache.map(role => role.id),
                warnings: 0,
                bans: 0,
                lastAction: null,
                notes: '',
                ticketIds: [],
            };

            await addUserToDatabase(newUser);
            Logger.info('User Added to Database', { user: member.user.tag, guild: member.guild.name });
        }

        // Retrieve the member role ID from the guild's config
        const memberRoleId = guildConfig.roles.memberRoleId;

        // Check if the user has the "member" role (verified role) in the current guild
        const isVerified = member.roles.cache.has(memberRoleId);

        // Update user verification status based on role
        if (isVerified) {
            await updateUserStatus(member.id, member.guild.id, { 
                verifiedStatus: true, 
                verificationDate: new Date().toISOString() 
            });
        }

        // Send verification embed to the user if not verified yet
        if (!isVerified) {
            const dmChannel = await member.createDM();
            const verificationEmbed = new EmbedBuilder()
                .setColor('#FFCC00')
                .setTitle('Verification Required')
                .setDescription(`Welcome to ${member.guild.name}, ${member.user.tag}! Please react with ✅ to verify your account.`)
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp();

            const verificationMessage = await dmChannel.send({ embeds: [verificationEmbed] });
            Logger.info('Verification Embed Sent to DM', { user: member.user.tag, guild: member.guild.name });

            // React with ✅ emoji
            await verificationMessage.react('✅');
            const filter = (reaction: any, user: any) => reaction.emoji.name === '✅' && user.id === member.id;

            // Create a collector to listen for reactions
            const collector = verificationMessage.createReactionCollector({ filter, time: 15 * 60 * 1000 });

            let reacted = false; // Flag to check if the user has reacted

            collector.on('collect', async () => {
                if (!reacted) { // Make sure to only handle the first reaction
                    reacted = true;
                    Logger.info('Verification Reaction Collected', { user: member.user.tag, guild: member.guild.name });

                    // Assign the verified role to the user
                    const verifiedRole = member.guild.roles.cache.get(guildConfig.roles.staffRoleId);

                    if (verifiedRole) {
                        await member.roles.add(verifiedRole);

                        // Update user data in the database to mark them as verified
                        await updateUserStatus(member.id, member.guild.id, { 
                            verifiedStatus: true, 
                            verificationDate: new Date().toISOString() 
                        });

                        Logger.info('User Verified', { user: member.user.tag, guild: member.guild.name });

                        // Send a thank-you message to the user
                        await member.send(`Thank you for verifying your account, ${member.user.tag}! You now have access to the server.`);

                        // Send welcome message to the server channel (using mainEntranceChannelId dynamically)
                        const mainEntranceChannel = member.guild.channels.cache.get(guildConfig.channels.mainEntranceChannelId);

                        if (mainEntranceChannel) {
                            const welcomeEmbed = new EmbedBuilder()
                                .setColor('#00FF00')
                                .setTitle('Welcome!')
                                .setDescription(`<@${member.id}> to ${member.guild.name}, We're excited to have you here!`)
                                .setTimestamp();

                            await mainEntranceChannel.send({ embeds: [welcomeEmbed] });
                            Logger.info('Welcome Message Sent', { user: member.user.tag, guild: member.guild.name });
                        }
                    }
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time' && !reacted) { // Only send the timeout message if no reaction was collected
                    Logger.info('Verification Timed Out', { user: member.user.tag, guild: member.guild.name });
                    member.send('Verification timed out. Please try again by reacting to the verification message.');
                }
            });
        }
    } catch (error) {
        Logger.error('Error Handling New Member', { user: member.user.tag, guild: member.guild.name, error: error.message });
    }
};
