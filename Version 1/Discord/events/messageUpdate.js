const { MessageEmbed } = require('discord.js');
const client = require('../index');
process.env = require('../config.json');

module.exports = {
    name: "messageUpdate",
    execute(oldMessage, newMessage) {
        if (oldMessage.author.bot) return;

        const count = 1950;
        const Before = oldMessage.content.slice("0", count) + (oldMessage.content.length > count? " ...":"");
        const After = newMessage.content.slice("0", count) + (newMessage.content.length > count? " ...":"");

        const logEmbed = new MessageEmbed()
        .setAuthor(`${newMessage.author.tag}`, newMessage.author.displayAvatarURL({dynamic: true}))
        .setColor('ORANGE')
        .setDescription(`**Message edited in** ${newMessage.channel} [jump to message](${newMessage.url})`)
        .addFields (
            { name: `**Before**`, value: `${Before}`},
            { name: `**After**`, value: `${After}`}
        )
        .setFooter(`User ID: ${newMessage.author.id} | Message ID: ${newMessage.id}`)
        .setTimestamp()

        if (newMessage.attachments.size > 0) {
            logEmbed.addField(`Attachments:`, `${newMessage.attachments.map((a) => a.url)}`, true)
        }
        newMessage.guild.channels.cache.get(process.env.discord.logId).send({embeds: [logEmbed]})
    }
}