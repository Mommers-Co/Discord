const { Client, GatewayIntentBits, Partials, MessageBuilder } = require('discord.js');
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
    
    try {
        const dmChannel = await member.createDM();
    
        const embed = new MessageEmbed()
            .setColor('#D08770')
            .setTitle('Welcome to Our Server!')
            .setDescription('We are excited to have you here! To get started, please verify your email by replying with your email address.')
            .setThumbnail('https://i.imgur.com/QmJkPOZ.png')
            .setFooter('Thank you for joining us!', 'https://i.imgur.com/QmJkPOZ.png');

        await dmChannel.send({ embeds: [embed] });

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

client.login(config.discord.botToken).catch(error => {
    logEvent('Failed to login', 'Error', error.message);
});
