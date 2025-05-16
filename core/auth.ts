import { Client, GuildMember, Guild, EmbedBuilder, TextChannel, MessageReaction, User, ReactionCollector } from 'discord.js';
import Logger from './logger';
import * as fs from 'fs';
import Database from './database';

const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

export const handleNewMemberJoin = async (client: Client, member: GuildMember) => {
    const guildConfig = Object.values(config.discord).find(
        (guild: { guildId: string }) => guild.guildId === member.guild.id);

    if (!guildConfig) {
        Logger.error(`Guild config missing for ${member.guild.name} (${member.guild.id})`);
        return;
    }

    Logger.info(`New member joined: ${member.user.tag} in ${member.guild.name}`);

    try {
        const userInDb = await Database.getUserByDiscordIdAndGuildId(member.id, member.guild.id);

        if (!userInDb) {
            await Database.addUserToDatabase({
                discordUserId: member.id,
                guildId: member.guild.id,
                username: member.user.tag,
                discordCreation: member.user.createdAt.toISOString(),
                JoinedAt: new Date().toISOString(),
                verifiedStatus: false,
                verificationDate: null,
                lastActive: new Date().toISOString(),
                roles: member.roles.cache.map((r) => r.id),
                warnings: 0,
                bans: 0,
                lastAction: null,
                notes: '',
                ticketIds: []
            });

            Logger.info(`User ${member.user.tag} added to database`);
        }

        const isAlreadyVerified = member.roles.cache.has(guildConfig.roles.memberRoleId);

        if (isAlreadyVerified) {
            await Database.updateUserStatus(member.id, member.guild.id, {
                verifiedStatus: true,
                verificationDate: new Date().toISOString()
            });
            return;
        }

        // Start verification via DM
        let dmChannel;
        try {
            dmChannel = await member.createDM();
        } catch (err) {
            Logger.warn(`Couldn't DM ${member.user.tag}: ${err}`);
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#FFCC00')
            .setTitle('Verification Required')
            .setDescription(`Hi ${member.user.tag}! React with ✅ to verify and get access.`)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        const msg = await dmChannel.send({ embeds: [embed] });
        await msg.react('✅');

        const filter = (reaction: MessageReaction, user: User) =>
            reaction.emoji.name === '✅' && user.id === member.id;

        const collector = msg.createReactionCollector({ filter, time: 15 * 60 * 1000 });

        Logger.info(`Started reaction collector for ${member.user.tag}`);

        collector.on('collect', async (reaction, user) => {
            try {
                if (reaction.partial) await reaction.fetch();
                if (user.partial) await user.fetch();

                const verifiedRole = member.guild.roles.cache.get(guildConfig.roles.memberRoleId);
                if (!verifiedRole) {
                    Logger.warn(`Verified role not found in ${member.guild.name}`);
                    return;
                }

                await member.roles.add(verifiedRole);
                Logger.info(`Verified role assigned to ${member.user.tag}`);

                await Database.updateUserStatus(member.id, member.guild.id, {
                    verifiedStatus: true,
                    verificationDate: new Date().toISOString()
                });

                await member.send(`✅ Thanks ${member.user.tag}, you are now verified!`);

                const entranceChannel = member.guild.channels.cache.get(guildConfig.channels.mainEntranceChannelId);
                if (entranceChannel instanceof TextChannel) {
                    const welcomeEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('Welcome!')
                        .setDescription(`<@${member.id}> to ${member.guild.name}!`)
                        .setTimestamp();

                    await entranceChannel.send({ embeds: [welcomeEmbed] });
                } else {
                    Logger.warn(`Entrance channel invalid or not found.`);
                }

                collector.stop('verified');

            } catch (err) {
                Logger.error(`Error verifying ${member.user.tag}: ${err}`);
            }
        });

        collector.on('end', (_, reason) => {
            if (reason === 'time') {
                member.send('⏰ Verification timed out. Please try again later.');
                Logger.warn(`Verification timed out for ${member.user.tag}`);
            } else {
                Logger.info(`Verification collector ended for ${member.user.tag} (reason: ${reason})`);
            }
        });

    } catch (error) {
        Logger.error(`Error in handleNewMemberJoin: ${error instanceof Error ? error.message : error}`);
    }
};

export const handleMemberLeave = async (client: Client, member: GuildMember) => {
    const guildConfig = Object.values(config.discord).find(
        (guild) => guild.guildId === member.guild.id
    );

    if (!guildConfig) {
        Logger.warn(`Guild config missing for leave event in ${member.guild.name}`);
        return;
    }

    Logger.info(`${member.user.tag} left ${member.guild.name}`);

    try {
        const channel = member.guild.channels.cache.get(guildConfig.channels.leaveLogChannelId);
        if (channel instanceof TextChannel) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Goodbye!')
                .setDescription(`${member.user.tag} has left ${member.guild.name}.`)
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        }
    } catch (error) {
        Logger.error(`Error in handleMemberLeave: ${error instanceof Error ? error.message : error}`);
    }
};
