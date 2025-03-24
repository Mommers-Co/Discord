import { Client, GuildMember, EmbedBuilder } from 'discord.js';
import Logger from './logger';
import * as fs from 'fs';
import Database from './database';

const config = JSON.parse(fs.readFileSync('config.json', 'utf-8')) as { discord: { [key: string]: { guildId: string; roles: { memberRoleId: string; staffRoleId: string }; channels: { mainEntranceChannelId: string; leaveLogChannelId: string } } } };

// Define types for guildConfig and user
interface GuildConfig {
    guildId: string;
    roles: {
        memberRoleId: string;
        staffRoleId: string;
    };
    channels: {
        mainEntranceChannelId: string;
        leaveLogChannelId: string;
    };
}

// Function to handle new member joining the server
export const handleNewMemberJoin = async (client: Client, member: GuildMember) => {
    const guildConfig = Object.values(config.discord).find(guild => guild.guildId === member.guild.id) as GuildConfig;

    if (!guildConfig) {
        Logger.error(`Guild configuration missing for ${member.guild.name} (ID: ${member.guild.id})`);
        return;
    }

    Logger.info(`New member joined: ${member.user.tag} in ${member.guild.name}`);

    try {
        const user = await Database.getUserByDiscordIdAndGuildId(member.id, member.guild.id);

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

            await Database.addUserToDatabase(newUser);
            Logger.info(`User added to database: ${member.user.tag}`);
        }

        const memberRoleId = guildConfig.roles.memberRoleId;
        const isVerified = member.roles.cache.has(memberRoleId);

        if (isVerified) {
            await Database.updateUserStatus(member.id, member.guild.id, {
                verifiedStatus: true,
                verificationDate: new Date().toISOString(),
            });
        } else {
            const dmChannel = await member.createDM();
            const verificationEmbed = new EmbedBuilder()
                .setColor('#FFCC00')
                .setTitle('Verification Required')
                .setDescription(`Welcome to ${member.guild.name}, ${member.user.tag}! Please react with ✅ to verify your account.`)
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp();

            const verificationMessage = await dmChannel.send({ embeds: [verificationEmbed] });
            await verificationMessage.react('✅');
            const filter = (reaction: any, user: any) => reaction.emoji.name === '✅' && user.id === member.id;
            const collector = verificationMessage.createReactionCollector({ filter, time: 15 * 60 * 1000 });

            collector.on('collect', async () => {
                const verifiedRole = member.guild.roles.cache.get(guildConfig.roles.staffRoleId);
                if (verifiedRole) {
                    await member.roles.add(verifiedRole);
                    await Database.updateUserStatus(member.id, member.guild.id, {
                        verifiedStatus: true,
                        verificationDate: new Date().toISOString(),
                    });

                    await member.send(`Thank you for verifying your account, ${member.user.tag}! You now have access to the server.`);
                    const mainEntranceChannel = member.guild.channels.cache.get(guildConfig.channels.mainEntranceChannelId);
                    if (mainEntranceChannel && mainEntranceChannel.isText()) {
                        const welcomeEmbed = new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('Welcome!')
                            .setDescription(`<@${member.id}> to ${member.guild.name}, We're excited to have you here!`)
                            .setTimestamp();

                        await mainEntranceChannel.send({ embeds: [welcomeEmbed] });
                    }
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    member.send('Verification timed out. Please try again by reacting to the verification message.');
                }
            });
        }
    } catch (error) {
        Logger.error(`Error handling new member ${member.user.tag}: ${error.message}`);
    }
};

// Function to handle member leaving the server
export const handleMemberLeave = async (client: Client, member: GuildMember) => {
    const guildConfig = Object.values(config.discord).find(guild => guild.guildId === member.guild.id) as GuildConfig;

    if (!guildConfig) {
        Logger.error(`Guild configuration missing for ${member.guild.name} (ID: ${member.guild.id})`);
        return;
    }

    Logger.info(`Member left: ${member.user.tag} from ${member.guild.name}`);

    try {
        const leaveChannel = member.guild.channels.cache.get(guildConfig.channels.leaveLogChannelId);
        if (leaveChannel && leaveChannel.isText()) {
            const leaveEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Goodbye!')
                .setDescription(`${member.user.tag} has left ${member.guild.name}.`)
                .setTimestamp();

            await leaveChannel.send({ embeds: [leaveEmbed] });
        }
    } catch (error) {
        Logger.error(`Error handling member leave ${member.user.tag}: ${error.message}`);
    }
};
