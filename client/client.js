const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const schedule = require('node-schedule');
const config = require('../config.json');
const { addUserToDatabase } = require('../gateway/appwrite');
const { logEvent } = require('../shared/logger');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ], 
    partials: [Partials.Channel] 
});

client.once('ready', () => {
    const message = `Client: ${client.user.tag} is online!`;
    console.log(message); // For debugging, keep this line if needed
    logEvent('Bot is online!', message);
});

client.on('guildMemberAdd', async (member) => {
    logEvent('New member joined', 'MemberEvent', { user: member.user.tag });
    
    let reminderJobs = [];
    let verificationMessage;
    const reminderInterval = 24 * 60 * 60 * 1000; // 24 hours

    try {
        const dmChannel = await member.createDM();
        const welcomeChannelId = config.channels.mainEntranceChannelId;

        if (!welcomeChannelId) {
            throw new Error('Welcome channel ID is not defined in config.json.');
        }

        const welcomeChannel = await client.channels.fetch(welcomeChannelId);

        // Welcome message for the new member
        if (welcomeChannel) {
            const welcomeTimestamp = new Date().toLocaleString();
            const embed = new EmbedBuilder()
                .setColor('#D08770')
                .setTitle('Welcome to Our Server!')
                .setDescription(`We are excited to have you here, ${member.user.tag}! To get started, please verify your account by reacting to the direct message.`)
                .setFooter({ text: `User ID: ${member.id} | Timestamp: ${welcomeTimestamp}`, iconURL: 'https://i.imgur.com/QmJkPOZ.png' });

            await welcomeChannel.send({ embeds: [embed] });
        } else {
            console.error(`[${new Date().toLocaleString()}] Welcome channel ${welcomeChannelId} not found.`);
            logEvent('DiscordError', 'Welcome channel not found', welcomeChannelId);
        }

        // DM message to the new member
        const dmEmbed = new EmbedBuilder()
            .setColor('#D08770')
            .setTitle('Welcome to Our Server!')
            .setDescription('To verify your account, please react with ✅ to this message.')
            .setFooter({ text: 'Thank you for joining us!', iconURL: 'https://i.imgur.com/QmJkPOZ.png' });

        verificationMessage = await dmChannel.send({ embeds: [dmEmbed] });
        await verificationMessage.react('✅'); // React with the verification emoji

        const filter = (reaction, user) => {
            return reaction.emoji.name === '✅' && user.id === member.id;
        };

        const collector = verificationMessage.createReactionCollector({ filter, time: 7 * 24 * 60 * 60 * 1000 }); // 7 days

        collector.on('collect', async () => {
            // Verification successful
            try {
                await addUserToDatabase({
                    discordUserId: member.id,
                    username: member.user.tag,
                    JoinedAt: new Date().toISOString(),
                    verifiedStatus: true,
                    verificationDate: new Date().toISOString(),
                    lastActive: new Date().toISOString(),
                    roles: JSON.stringify(member.roles.cache.map(role => role.id)),
                    warnings: 0,
                    bans: 0,
                    lastAction: null,
                    notes: '',
                    ticketIds: JSON.stringify([]),
                    discordCreation: member.user.createdAt.toISOString(),
                    registeredEmail: 'N/A' // Replace with actual email if available
                });

                // Ensure the member role is added
                if (!member.roles.cache.has(config.roles.memberRoleId)) {
                    await member.roles.add(config.roles.memberRoleId);
                    logEvent('Member verified and role added', 'MemberEvent', { user: member.user.tag });

                    // Send a thank you message
                    const thankYouEmbed = new EmbedBuilder()
                        .setColor('#D08770')
                        .setTitle('Verification Complete!')
                        .setDescription(`Thank you for verifying your account, ${member.user.tag}! You now have access to the Mommers Co Discord.`)
                        .setFooter({ text: `User ID: ${member.id}`, iconURL: 'https://i.imgur.com/QmJkPOZ.png' });

                    await dmChannel.send({ embeds: [thankYouEmbed] });
                }

                // Stop the collector
                collector.stop('verified');

                // Clear all reminder jobs
                reminderJobs.forEach(job => job.cancel());
            } catch (error) {
                logEvent('Error adding user to Appwrite', 'Error', error.message);
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason !== 'verified') {
                await member.kick('Verification not completed');
                logEvent('Member kicked due to non-verification', 'MemberEvent', { user: member.user.tag });
            }
        });

        // Schedule reminders correctly
        const reminderJob = (day) => {
            const jobStart = Date.now() + day * reminderInterval;
            const job = schedule.scheduleJob({ start: jobStart, end: jobStart + reminderInterval }, async () => {
                if (!member.roles.cache.has(config.roles.memberRoleId)) {
                    const reminderEmbed = new EmbedBuilder()
                        .setColor('#D08770')
                        .setTitle('Reminder: Verify Your Account')
                        .setDescription(`Please verify your account by reacting with ✅ to the verification message. You have ${7 - day} day${7 - day > 1 ? 's' : ''} left to complete the verification process.`)
                        .setFooter({ text: 'Mommers Co', iconURL: 'https://i.imgur.com/QmJkPOZ.png' });

                    await dmChannel.send({ embeds: [reminderEmbed] });
                }
            });

            reminderJobs.push(job);
        };

        for (let i = 1; i <= 6; i++) {
            reminderJob(i);
        }

        // Final reminder on the 7th day
        schedule.scheduleJob({ start: Date.now() + 7 * reminderInterval }, async () => {
            if (!member.roles.cache.has(config.roles.memberRoleId)) {
                const finalReminderEmbed = new EmbedBuilder()
                    .setColor('#D08770')
                    .setTitle('Final Reminder: Verify Your Account')
                    .setDescription('This is your final reminder to verify your account by reacting with ✅ to the verification message. Failure to do so will result in removal from the server.')
                    .setFooter({ text: 'Mommers Co', iconURL: 'https://i.imgur.com/QmJkPOZ.png' });

                await dmChannel.send({ embeds: [finalReminderEmbed] });
            }
        });
    } catch (error) {
        logEvent('Error handling new member', 'Error', error.message);
    }
});

client.on('guildMemberRemove', async (member) => {
    const leaveTimestamp = new Date().toLocaleString();
    logEvent('Member left', 'MemberEvent', { user: member.user.tag, userId: member.id, timestamp: leaveTimestamp });
    
    try {
        const leaveChannelId = config.channels.mainEntranceChannelId;

        if (!leaveChannelId) {
            throw new Error('Leave channel ID is not defined in config.json.');
        }

        const leaveChannel = await client.channels.fetch(leaveChannelId);

        if (leaveChannel) {
            const leaveEmbed = new EmbedBuilder()
                .setColor('#D08770')
                .setTitle('Member Left')
                .setDescription(`${member.user.tag} left the server.`)
                .setThumbnail(member.user.displayAvatarURL())
                .setFooter({ text: `User ID: ${member.id} | Timestamp: ${leaveTimestamp}`, iconURL: 'https://i.imgur.com/QmJkPOZ.png' });

            if (!member.roles.cache.has(config.roles.memberRoleId)) {
                leaveEmbed.setDescription(`${member.user.tag} left the server due to non-verification.`);
            }

            await leaveChannel.send({ embeds: [leaveEmbed] });
        } else {
            console.error(`[${new Date().toLocaleString()}] Leave channel ${leaveChannelId} not found.`);
            logEvent('DiscordError', 'Leave channel not found', leaveChannelId);
        }
    } catch (error) {
        logEvent('Error handling member leave', 'Error', error.message);
    }
});

client.login(config.discord.botToken).catch(error => {
    logEvent('Failed to login', 'Error', error.message);
});
