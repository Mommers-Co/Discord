const { Client, GatewayIntentBits, Partials, MessageEmbed } = require('discord.js');
const schedule = require('node-schedule');
const config = require('../config.json');
const { addUserToDatabase } = require('../gateway/appwrite');
const { logEvent } = require('../shared/logger');

const client = require('../gateway/clientInitializer');

client.once('ready', () => {
    const message = `Client: ${client.user.tag} is online!`;
    console.log(message); // For debugging, keep this line if needed
    logEvent('Bot is online!', 'Startup', message);
});

client.on('guildMemberAdd', async (member) => {
    // Log join to the console channel
    logEvent('New member joined', 'MemberEvent', { user: member.user.tag });
    try {
        const consoleChannel = await client.channels.fetch(config.discord.discordConsoleId);
        if (consoleChannel) {
            const joinMessage = `User ${member.user.tag} has joined the server.`;
            consoleChannel.send(joinMessage);
        } else {
            console.error('Console channel not found.');
        }
    } catch (error) {
        logEvent('Error fetching console channel', 'Error', error.message);
    }

    // Send welcome message
    try {
        const welcomeChannel = await client.channels.fetch(config.discord.welcomeChannelId);
        if (welcomeChannel) {
            const embed = new MessageEmbed()
                .setColor('#D08770')
                .setTitle('Welcome to Our Server!')
                .setDescription('We are excited to have you here! To get started, please verify your email by replying with your email address.')
                .setThumbnail('https://i.imgur.com/QmJkPOZ.png')
                .setFooter('Thank you for joining us!', 'https://i.imgur.com/QmJkPOZ.png');

            await welcomeChannel.send({ embeds: [embed] });
        } else {
            console.error('Welcome channel not found.');
        }
    } catch (error) {
        logEvent('Error sending welcome message', 'Error', error.message);
    }

    // Handle email verification
    try {
        const dmChannel = await member.createDM();

        const filter = m => m.author.id === member.user.id;
        const collector = dmChannel.createMessageCollector({ filter, time: 7 * 24 * 60 * 60 * 1000 }); // 7 days

        collector.on('collect', async (m) => {
            const email = m.content;
            // Here you would add your email verification logic

            await addUserToDatabase({
                email,
                username: member.user.tag,
                discordId: member.id
            });
            
            logEvent('User added to database', 'AppwriteUpdate', { user: member.user.tag });
            await member.roles.add(config.roles.memberRoleId);
            logEvent('Member verified and role added', 'MemberEvent', { user: member.user.tag });
            collector.stop('verified');
        });

        collector.on('end', async (collected, reason) => {
            if (reason !== 'verified') {
                await member.kick('Verification not completed');
                logEvent('Member kicked due to non-verification', 'MemberEvent', { user: member.user.tag });
            }
        });

        schedule.scheduleJob({ end: Date.now() + (6 * 24 * 60 * 60 * 1000) }, async () => {
            if (!member.roles.cache.has(config.roles.memberRoleId)) {
                const reminderEmbed = new MessageEmbed()
                    .setColor('#D08770')
                    .setTitle('Reminder: Verify Your Account')
                    .setDescription('Please verify your email. You have 1 day left to complete the verification process.')
                    .setThumbnail('https://i.imgur.com/QmJkPOZ.png')
                    .setFooter('Mommers Co', 'https://i.imgur.com/QmJkPOZ.png');

                await dmChannel.send({ embeds: [reminderEmbed] });
            }
        });
    } catch (error) {
        logEvent('Error handling new member', 'Error', error.message);
    }
});

client.on('guildMemberRemove', async (member) => {
    // Log leave to the console channel
    logEvent('Member left the server', 'MemberEvent', { user: member.user.tag });
    try {
        const consoleChannel = await client.channels.fetch(config.discord.discordConsoleId);
        if (consoleChannel) {
            const leaveMessage = `User ${member.user.tag} has left the server.`;
            consoleChannel.send(leaveMessage);
        } else {
            console.error('Console channel not found.');
        }
    } catch (error) {
        logEvent('Error fetching console channel', 'Error', error.message);
    }
});

client.login(config.discord.botToken).catch(error => {
    logEvent('Failed to login', 'Error', error.message);
});
