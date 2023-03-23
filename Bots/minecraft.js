const Gamedig = require('gamedig')
const Discord = require('discord.js')
const client = new Discord.Client({ intents: ['GUILDS'] })

var status = {}

function Start(token, game) {
    client.login(token)

    client.on('ready', async () => {
        console.log(`Minecraft Logged in as ${client.user.tag}!`);
        client.user.setActivity(`Collecting Data...`, { type: 'WATCHING' })
        client.user.setStatus('idle')

        function refresh() {

            process.data.games[game] = status

            Gamedig.query({
                type: 'minecraft',
                host: '192.168.1.55',
                maxAttempts: 3,
                socketTimeout: 3000,
                port: 25565
            }).then((body) => {
                status = body
                if (body.raw.numplayers > 0) {
                    client.user.setActivity(`${body.raw.numplayers} / ${body.maxplayers} Players / Ping ${body.ping} `,  { type: 'WATCHING' })
                    client.user.setStatus('online')
                }
                else {
                    client.user.setActivity(`No Players Online / Ping ${body.ping}`, { type: 'WATCHING' })
                    client.user.setStatus('idle')
                }
            }).catch((error) => {
                status = {}
                client.user.setActivity(`Server Offline`, { type: 'WATCHING' })
                client.user.setStatus('dnd')
            })

        }
        setInterval(refresh, 10000)
        
    })
}

module.exports = {
    Start: Start
}