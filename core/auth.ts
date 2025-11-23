import { Client, GuildMember, PartialGuildMember, EmbedBuilder, TextChannel, ButtonBuilder, ButtonStyle, ActionRowBuilder, InteractionCollector, ButtonInteraction, ComponentType } from 'discord.js';
import Logger from './logger';
import * as fs from 'fs';
import Database from './database';

interface GuildRoles {
    memberRoleId: string;
}

interface GuildChannels {
    EntranceChannelId: string;
}

interface GuildConfig {
    guildId: string;
    roles: GuildRoles;
    channels: GuildChannels;
}

interface DiscordConfig {
    guilds: {
        [guildId: string]: GuildConfig;
    };
}

interface AppConfig {
    discord: DiscordConfig;
}


// Load config once
const config: AppConfig = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

export async function handleNewMemberJoin(client: Client, member: GuildMember) {
    const guildConfig = config.discord.guilds[member.guild.id];
    if (!guildConfig) {
        Logger.error(`Guild config missing for guild ${member.guild.name} (${member.guild.id})`);
        return;
    }

    Logger.info(`Member joined: ${member.user.tag} in guild ${member.guild.name}`);

        try {
        // Check if user exists in DB
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

        const verifiedRoleId = guildConfig.roles.memberRoleId;

        if (member.roles.cache.has(verifiedRoleId)) {
        await Database.updateUserStatus(member.id, member.guild.id, {
        verifiedStatus: true,
        verificationDate: new Date().toISOString(),
        });
        Logger.info(`${member.user.tag} already verified`);
        return;
        }

        async function attemptVerification() {
        let dmChannel;
        try {
        dmChannel = await member.createDM();
        } catch (err) {
        Logger.warn(`Could not DM ${member.user.tag}: ${err instanceof Error ? err.message : String(err)}`);
        return;
        }

        const verifyEmbed = new EmbedBuilder()
        .setColor('#FFCC00')
        .setTitle('Verification Required')
        .setDescription(`Hi ${member.user.tag}! Please click the button below to verify yourself.`)
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

        const verifyButton = new ButtonBuilder().setCustomId('verify_button').setLabel('✅ Verify Me').setStyle(ButtonStyle.Success);

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
            await interaction.deferUpdate();

            const verifiedRole = member.guild.roles.cache.get(verifiedRoleId);

            if (!verifiedRole) {
            Logger.warn(`Verified role not found in guild ${member.guild.name}`);
            await interaction.followUp({ content: 'Verification role is missing. Please contact an admin.', ephemeral: true });
            return;
            }

            await member.roles.add(verifiedRole);
            Logger.info(`Assigned verified role to ${member.user.tag}`);

            await Database.updateUserStatus(member.id, member.guild.id, {
                verifiedStatus: true,
                verificationDate: new Date().toISOString(),
            });

            await interaction.editReply({
            content: `✅ You're verified! Welcome to **${member.guild.name}**.`,
            embeds: [],
            components: [],
            });

            const entranceChannel = member.guild.channels.cache.get(guildConfig.channels.EntranceChannelId);
            if (entranceChannel && entranceChannel instanceof TextChannel) {
            const welcomeEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Welcome!')
                .setDescription(`<@${member.id}> to ${member.guild.name}!`)
                .setTimestamp();
            await entranceChannel.send({ embeds: [welcomeEmbed] });
            }

            collector.stop('verified');
        } catch (err) {
            Logger.error(`Verification error for ${member.user.tag}: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
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
            time: 30 * 60 * 1000, // 30 minutes retry window
            });

            retryCollector.on('collect', async (interaction) => {
            if (interaction.customId === 'retry_verification' && interaction.user.id === member.id) {
                await interaction.deferUpdate();
                retryCollector.stop();
                await attemptVerification(); // Retry
            }
            });

            retryCollector.on('end', () => {
            Logger.warn(`Retry verification collector ended for ${member.user.tag}`);
            });
        } catch (err) {
            Logger.error(`Error sending retry prompt for ${member.user.tag}: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
        }

        Logger.warn(`Verification timed out for ${member.user.tag}`);
        } else {
        Logger.info(`Verification completed for ${member.user.tag} with reason: ${reason}`);
        }
        });
        }

        await attemptVerification();
        } catch (error) {
        Logger.error(`handleNewMemberJoin error: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
        }
        }

        export async function handleMemberLeave(client: Client, member: GuildMember | PartialGuildMember) {
        if (!member.guild || !member.guild.id) {
        Logger.warn(`Member guild or guild.id missing on leave event for member ID ${member.id}`);
        return;
        }

        const guildConfig = config.discord.guilds[member.guild.id];
        if (!guildConfig) {
        Logger.warn(`Guild config missing on member leave for guild ${member.guild?.name || member.guild.id}`);
        return;
        }

        const leaveChannelId = guildConfig.channels.EntranceChannelId;
        const leaveChannel = member.guild.channels.cache.get(leaveChannelId);

        if (!leaveChannel || !(leaveChannel instanceof TextChannel)) {
        Logger.warn(`Leave log channel invalid or not found in guild ${member.guild.name}`);
        return;
        }

        try {
        if (member.partial) {
        Logger.info(`Partial member with ID ${member.id} left guild ${member.guild.name}`);

        const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Goodbye!')
        .setDescription(`A member has left **${member.guild.name}**.`)
        .setTimestamp();

        await leaveChannel.send({ embeds: [embed] });
        } else {
        Logger.info(`${member.user.tag} left guild ${member.guild.name}`);

        const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Goodbye!')
        .setDescription(`${member.user.tag} has left **${member.guild.name}**.`)
        .setTimestamp();

        await leaveChannel.send({ embeds: [embed] });
        }
        } catch (err) {
    Logger.error(`handleMemberLeave error: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    }
}
