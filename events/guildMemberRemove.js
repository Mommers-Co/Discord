const Discord = require('discord.js');

module.exports = {
    name: "guildMemberRemove",
    async execute(member) {
        //console.log(`${member.user.tag} left the server.`);

        const LeaveEmbed = new Discord.MessageEmbed()
            .setColor("#d81e5b")
            .setDescription(`${member.user} left the server!`)

            member.guild.channels.cache.get("969241414561062946").send({ embeds: [LeaveEmbed]})
    }
}

