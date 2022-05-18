const { MessageEmbed, Message } = require('discord.js');
const client = require('../index');
process.env = require('../config.json');

module.exports = {
    name: "messageDelete",
    execute(message) {
		if(message.author.bot) return;
        const log = new MessageEmbed()
        .setAuthor(`${message.author.tag}`, message.author.displayAvatarURL({dynamic: true}))
        .setColor('RED')
        .setDescription(`**Message deleted in** ${message.channel}`)
        .addFields (
            { name: `Deleted Message`, value: `${message.content ? message.content : "none"}`.slice(0, 4096)}
        )
        .setFooter(`User ID: ${message.author.id} | Deleted by: Moderator`)
        .setTimestamp()

        if (message.attachments.size > 1) {
            log.addField(`Attachments:`, `${message.attachments.map((a) => a.url)}`, true)
        }
        message.guild.channels.cache.get(process.env.discord.logId).send({embeds: [log]}).catch((err) => {console.log(err)});
    }
}
