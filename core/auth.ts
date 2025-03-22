import { Client, GuildMember, EmbedBuilder } from 'discord.js';
import Logger from './logger';
import { getUserByDiscordId, addUserToDatabase, updateUserStatus } from './database';

// Assuming that client.guildSettings is already populated in the client instance
export const handleNewMemberJoin = async (client: Client, member: GuildMember) => {
    // Retrieve guild config from the client.cache
    const guildConfig = client.guildSettings.get(member.guild.id);
    
    // Check if the configuration for the guild exists
    if (!guildConfig) {
        Logger.error('Guild Configuration Missing', { guildId: member.guild.id });
        return;
    }

    Logger.info('New Member Joined', { user: member.user.tag, userId: member.id, guild: member.guild.name });

    try {
        const user = await getUserByDiscordId(member.id);

        // If user is new, add them to the database
        if (!user) {
            const newUser = {
                discordUserId: member.id,
                username: member.user.tag,
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
                discordCreation: member.user.createdAt.toISOString(),
            };

            await addUserToDatabase(newUser);
            Logger.info('User Added to Database', { user: member.user.tag, guild: member.guild.name });
        }

        // Send verification embed to the user
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

        collector.on('collect', async () => {
            Logger.info('Verification Reaction Collected', { user: member.user.tag, guild: member.guild.name });

            // Assign the verified role to the user
            const verifiedRole = member.guild.roles.cache.get(guildConfig.verifiedRoleId);

            if (verifiedRole) {
                await member.roles.add(verifiedRole);
                await updateUserStatus(member.id, { verifiedStatus: true, verificationDate: new Date().toISOString() });
                Logger.info('User Verified', { user: member.user.tag, guild: member.guild.name });

                // Send a thank-you message to the user
                await member.send(`Thank you for verifying your account, ${member.user.tag}! You now have access to the server.`);

                // Send welcome message to the server channel
                const welcomeEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('Welcome!')
                    .setDescription(`<@${member.id}> to ${member.guild.name}, We're excited to have you here!`)
                    .setTimestamp();

                const welcomeChannel = member.guild.channels.cache.get(guildConfig.welcomeChannelId); // Use the guild-specific welcome channel

                if (welcomeChannel) {
                    await welcomeChannel.send({ embeds: [welcomeEmbed] });
                    Logger.info('Welcome Message Sent', { user: member.user.tag, guild: member.guild.name });
                }
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                Logger.info('Verification Timed Out', { user: member.user.tag, guild: member.guild.name });
                member.send('Verification timed out. Please try again by reacting to the verification message.');
            }
        });
    } catch (error) {
        Logger.error('Error Handling New Member', { user: member.user.tag, guild: member.guild.name, error: error.message });
    }
};

export const handleMemberLeave = async (client: Client, member: GuildMember) => {
    // Retrieve guild config from the client.cache
    const guildConfig = client.guildSettings.get(member.guild.id);
    
    // Check if the configuration for the guild exists
    if (!guildConfig) {
        Logger.error('Guild Configuration Missing', { guildId: member.guild.id });
        return;
    }

    Logger.info('Member Left', { user: member.user.tag, userId: member.id, guild: member.guild.name });

    try {
        await updateUserStatus(member.id, { verifiedStatus: false });
        Logger.info('User Status Updated to Unverified', { user: member.user.tag, guild: member.guild.name });

        const leaveEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Goodbye!')
            .setDescription(`${member.user.tag} has left ${member.guild.name}, We're sad to see you go!`)
            .setTimestamp();

        const leaveChannel = member.guild.channels.cache.get(guildConfig.leaveChannelId); // Use the guild-specific leave channel
        if (leaveChannel) {
            await leaveChannel.send({ embeds: [leaveEmbed] });
        }
    } catch (error) {
        Logger.error('Error Handling Member Leave', { user: member.user.tag, guild: member.guild.name, error: error.message });
    }
};
