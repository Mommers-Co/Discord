import { Client, GuildMember, EmbedBuilder, TextChannel, ButtonBuilder, ButtonStyle, ActionRowBuilder, InteractionCollector, ButtonInteraction, ComponentType  } from 'discord.js';
import Logger from './logger';
import * as fs from 'fs';
import Database from './database';

interface GuildRoles {
    memberRoleId: string;
}

interface GuildChannels {
    mainEntranceChannelId: string;
    leaveLogChannelId: string;
}

interface GuildConfig {
    guildId: string;
    roles: GuildRoles;
    channels: GuildChannels;
}

interface DiscordConfig {
    [key: string]: GuildConfig;
}

interface AppConfig {
    discord: DiscordConfig;
}

const config: AppConfig = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

export const handleNewMemberJoin = async (client: Client, member: GuildMember) => {
    const guildConfig = Object.values(config.discord).find(
        (guild) => guild.guildId === member.guild.id
    );

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
                ticketIds: [],
            });

            Logger.info(`User ${member.user.tag} added to database`);
        }

        const isVerified = member.roles.cache.has(guildConfig.roles.memberRoleId);
        if (isVerified) {
            await Database.updateUserStatus(member.id, member.guild.id, {
                verifiedStatus: true,
                verificationDate: new Date().toISOString(),
            });
            Logger.info(`${member.user.tag} already verified`);
            return;
        }

        // Verification attempt function with button support
        const attemptVerification = async () => {
            let dmChannel;
            try {
                dmChannel = await member.createDM();
            } catch (err) {
                Logger.warn(`Could not DM ${member.user.tag}: ${err}`);
                return;
            }

            const verifyEmbed = new EmbedBuilder()
                .setColor('#FFCC00')
                .setTitle('Verification Required')
                .setDescription(`Hi ${member.user.tag}! Click the button below to verify.`)
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp();

            const verifyButton = new ButtonBuilder()
                .setCustomId('verify_button')
                .setLabel('✅ Verify Me')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(verifyButton);

            const dmMessage = await dmChannel.send({ embeds: [verifyEmbed], components: [row] });

            const collector = dmMessage.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 15 * 60 * 1000, // 15 minutes
            }) as InteractionCollector<ButtonInteraction>;

            Logger.info(`Started verification collector for ${member.user.tag}`);

            collector.on('collect', async (interaction) => {
                if (interaction.customId === 'verify_button' && interaction.user.id === member.id) {
                    try {
                        const verifiedRole = member.guild.roles.cache.get(guildConfig.roles.memberRoleId);
                        if (!verifiedRole) {
                            Logger.warn(`Verified role not found in ${member.guild.name}`);
                            await interaction.reply({ content: `Verification role is missing.`, ephemeral: true });
                            return;
                        }

                        await member.roles.add(verifiedRole);
                        Logger.info(`Verified role assigned to ${member.user.tag}`);

                        await Database.updateUserStatus(member.id, member.guild.id, {
                            verifiedStatus: true,
                            verificationDate: new Date().toISOString(),
                        });

                        await interaction.update({
                            content: `✅ You're verified! Welcome to **${member.guild.name}**.`,
                            embeds: [],
                            components: [],
                        });

                        const entranceChannel = member.guild.channels.cache.get(
                            guildConfig.channels.mainEntranceChannelId
                        );
                        if (entranceChannel instanceof TextChannel) {
                            const welcomeEmbed = new EmbedBuilder()
                                .setColor('#00FF00')
                                .setTitle('Welcome!')
                                .setDescription(`<@${member.id}> to ${member.guild.name}!`)
                                .setTimestamp();

                            await entranceChannel.send({ embeds: [welcomeEmbed] });
                        }

                        collector.stop('verified');
                    } catch (err) {
                        Logger.error(`Error verifying ${member.user.tag}: ${err}`);
                    }
                }
            });

            collector.on('end', async (_collected, reason) => {
                if (reason !== 'verified') {
                    try {
                        const retryEmbed = new EmbedBuilder()
                            .setColor('#FFA500')
                            .setTitle('Verification Timeout')
                            .setDescription('⏰ Verification timed out. Click the button below to retry.')
                            .setTimestamp();

                        const retryButton = new ButtonBuilder()
                            .setCustomId('retry_verification')
                            .setLabel('🔄 Retry Verification')
                            .setStyle(ButtonStyle.Primary);

                        const retryRow = new ActionRowBuilder<ButtonBuilder>().addComponents(retryButton);

                        const retryMsg = await dmChannel.send({ embeds: [retryEmbed], components: [retryRow] });

                        const retryCollector = retryMsg.createMessageComponentCollector({
                            componentType: ComponentType.Button,
                            time: 30 * 60 * 1000, // Allow retry for 30 minutes
                        });

                        retryCollector.on('collect', async (interaction) => {
                            if (interaction.customId === 'retry_verification' && interaction.user.id === member.id) {
                                await interaction.deferUpdate();
                                retryCollector.stop();
                                await attemptVerification(); // Retry
                            }
                        });

                        retryCollector.on('end', () => {
                            Logger.warn(`Retry collector ended for ${member.user.tag}`);
                        });
                    } catch (err) {
                        Logger.error(`Error sending retry prompt: ${err}`);
                    }
                    Logger.warn(`Verification timed out for ${member.user.tag}`);
                } else {
                    Logger.info(`Verification collector ended for ${member.user.tag} (reason: ${reason})`);
                }
            });
        };

        await attemptVerification();
    } catch (error) {
        Logger.error(`handleNewMemberJoin error: ${error instanceof Error ? error.message : error}`);
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
        const channel = member.guild.channels.cache.get(guildConfig.channels.mainEntranceChannelId);
        if (channel instanceof TextChannel) {
            const leaveEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Goodbye!')
                .setDescription(`${member.user.tag} has left ${member.guild.name}.`)
                .setTimestamp();

            await channel.send({ embeds: [leaveEmbed] });
        } else {
            Logger.warn(`Leave log channel invalid or not found.`);
        }
    } catch (error) {
        Logger.error(`handleMemberLeave error: ${error instanceof Error ? error.message : error}`);
    }
};
