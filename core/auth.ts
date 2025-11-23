import { 
    Client, 
    GuildMember, 
    PartialGuildMember, 
    EmbedBuilder, 
    TextChannel, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder, 
    ButtonInteraction, 
    ComponentType,
    Colors 
} from 'discord.js';
import Logger from './logger';
import * as fs from 'fs';
import Database from './database';

// --- Configuration Interfaces ---
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

// Load config synchronously (Standard practice for startup config)
const config: AppConfig = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

/**
 * Handles the event when a new member joins a guild.
 * Triggers the verification DM flow.
 */
export async function handleNewMemberJoin(client: Client, member: GuildMember) {
    // 1. Validate Configuration
    const guildConfig = config.discord.guilds[member.guild.id];
    if (!guildConfig) {
        Logger.error(`[Auth] Guild config missing for guild: ${member.guild.name} (${member.guild.id})`);
        return;
    }

    Logger.info(`[Auth] Member joined: ${member.user.tag} in guild ${member.guild.name}`);

    try {
        // 2. Database Sync (Ensure user is in DB)
        let userInDb = await Database.getUserByDiscordIdAndGuildId(member.id, member.guild.id);
        
        if (!userInDb) {
            Logger.info(`[Auth] New user detected. Adding ${member.user.tag} to database...`);
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
        }

        // 3. Check if already verified (Auto-Verify logic)
        const verifiedRoleId = guildConfig.roles.memberRoleId;
        if (member.roles.cache.has(verifiedRoleId)) {
            Logger.info(`[Auth] ${member.user.tag} already has the verified role. Updating DB status.`);
            await Database.updateUserStatus(member.id, member.guild.id, {
                verifiedStatus: true,
                verificationDate: new Date().toISOString(),
            });
            return; 
        }

        // 4. Start Verification Flow
        await startVerificationDM(member, guildConfig, verifiedRoleId);

    } catch (error) {
        Logger.error(`[Auth] Critical error in handleNewMemberJoin: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Internal function to handle sending the DM and listening for the button click.
 */
async function startVerificationDM(member: GuildMember, guildConfig: GuildConfig, verifiedRoleId: string) {
    let dmChannel;
    try {
        dmChannel = await member.createDM();
    } catch (err) {
        Logger.warn(`[Auth] Could not DM ${member.user.tag}. They may have DMs closed.`);
        return;
    }

    // Build the UI
    const verifyEmbed = new EmbedBuilder()
        .setColor(Colors.Yellow) // Using Discord v14 Colors enum
        .setTitle('Verification Required')
        .setDescription(`Hi **${member.user.username}**! \n\nTo access **${member.guild.name}**, please verify yourself by clicking the button below.`)
        .setThumbnail(member.guild.iconURL()) // Use guild icon for context
        .setTimestamp();

    const verifyButton = new ButtonBuilder()
        .setCustomId('verify_button')
        .setLabel('Verify Me')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(verifyButton);

    let dmMessage;
    try {
        dmMessage = await dmChannel.send({ embeds: [verifyEmbed], components: [row] });
    } catch (error) {
        Logger.warn(`[Auth] Failed to send DM message: ${error}`);
        return;
    }

    Logger.info(`[Auth] Verification DM sent to ${member.user.tag}. Waiting for response...`);

    // Create Collector
    const collector = dmMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 15 * 60 * 1000, // 15 Minutes
    });

    collector.on('collect', async (interaction: ButtonInteraction) => {
        // Guard Clause: Ensure it's the correct button
        if (interaction.customId !== 'verify_button') return;

        try {
            // --- 🚨 CRITICAL FIX: IMMEDIATE DEFERRAL 🚨 ---
            // This stops the "This interaction failed" error.
            // We use deferUpdate() because we plan to edit the message components later.
            await interaction.deferUpdate();
            
            // 1. Validate Logic
            // Re-fetch the role to ensure it still exists
            const verifiedRole = member.guild.roles.cache.get(verifiedRoleId);
            if (!verifiedRole) {
                Logger.error(`[Auth] Verified role (${verifiedRoleId}) not found in guild ${member.guild.name}`);
                await interaction.followUp({ content: "❌ Configuration Error: The verified role does not exist. Please contact an admin.", ephemeral: true });
                return;
            }

            // 2. Assign Role (Discord API)
            // Note: member might be cached; strictly we should fetch, but cache is usually fine for join events.
            await member.roles.add(verifiedRole);
            Logger.info(`[Auth] Assigned role to ${member.user.tag}`);

            // 3. Update Database
            await Database.updateUserStatus(member.id, member.guild.id, {
                verifiedStatus: true,
                verificationDate: new Date().toISOString(),
            });

            // 4. Success UI Update (Use editReply since we deferred)
            await interaction.editReply({
                content: `✅ **Verification Successful!**\n\nYou now have access to **${member.guild.name}**.`,
                embeds: [],
                components: [] // Remove the button so they can't click it again
            });

            // 5. Server Welcome Message
            await sendWelcomeMessage(member, guildConfig);

            // Stop the collector since we are done
            collector.stop('verified');

        } catch (error) {
            Logger.error(`[Auth] Error during verification processing: ${error}`);
            
            // Try to notify user if something went wrong
            try {
                await interaction.followUp({ content: "❌ An error occurred while verifying you. Please contact a server administrator.", ephemeral: true });
            } catch (e) { /* Ignore if followUp fails */ }
        }
    });

    collector.on('end', (_collected, reason) => {
        if (reason !== 'verified') {
            Logger.info(`[Auth] Verification collector timed out for ${member.user.tag}`);
            // Optional: Edit the message to say "Timed Out"
            if (dmMessage.editable) {
                dmMessage.edit({ 
                    content: "⏰ **Verification Timed Out**\nPlease rejoin the server to try again.", 
                    components: [] 
                }).catch(() => {});
            }
        }
    });
}

async function sendWelcomeMessage(member: GuildMember, guildConfig: GuildConfig) {
    const entranceChannelId = guildConfig.channels.EntranceChannelId;
    const entranceChannel = member.guild.channels.cache.get(entranceChannelId);

    if (entranceChannel && entranceChannel instanceof TextChannel) {
        const welcomeEmbed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('Welcome!')
            .setDescription(`👋 Welcome <@${member.id}> to **${member.guild.name}**!`)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        try {
            await entranceChannel.send({ embeds: [welcomeEmbed] });
        } catch (error) {
            Logger.warn(`[Auth] Failed to send welcome message to channel ${entranceChannelId}: ${error}`);
        }
    }
}

/**
 * Handles member leave events.
 */
export async function handleMemberLeave(client: Client, member: GuildMember | PartialGuildMember) {
    if (!member.guild) return;

    const guildConfig = config.discord.guilds[member.guild.id];
    if (!guildConfig) return;

    const leaveChannelId = guildConfig.channels.EntranceChannelId;
    const leaveChannel = member.guild.channels.cache.get(leaveChannelId);

    if (leaveChannel && leaveChannel instanceof TextChannel) {
        const embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('Goodbye!')
            .setDescription(`${member.user ? member.user.tag : 'Unknown User'} has left **${member.guild.name}**.`)
            .setTimestamp();

        try {
            await leaveChannel.send({ embeds: [embed] });
        } catch (error) {
            Logger.error(`[Auth] Failed to log leave: ${error}`);
        }
    }
}