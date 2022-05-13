const Discord = require('discord.js');

module.exports = {
    name: "guildMemberAdd",
    async execute(member) {
        //console.log(`${member.user.tag} joined the server.`);

        const WelcomeEmbed = new Discord.MessageEmbed()
            .setColor("AQUA")
            .setDescription(`${member.user} joined the server!`)

            member.guild.channels.cache.get("969241414561062946").send({ embeds: [WelcomeEmbed]})
    }
}

