const Gamedig = require('gamedig')
const Discord = require('discord.js')
const client = new Discord.Client({ intents: ['GUILDS'] })

var page = 0
var status = {}

function Start(token, game) {
    client.login(token)

    client.on('ready', async () => {
        console.log(`Logged in as ${client.user.tag}!`);
        client.user.setActivity(`Collecting Data...`, { type: 'WATCHING' })
        client.user.setStatus('idle')

        function refresh() {

            process.data.games[game] = status

            Gamedig.query({
                type: 'minecraft',
                host: '139.99.133.18',
                maxAttempts: 3,
                socketTimeout: 3000,
                port: 25565
            }).then((body) => {
                status = body
                client.user.setStatus('online')
                if (page === 0) {(body.raw.vanilla.raw.players.online > 0)
                    page = 1
                    client.user.setActivity(`${body.raw.vanilla.raw.players.online} / ${body.raw.vanilla.raw.players.max} Players`, { type: 'WATCHING' })
                    return
                }
                if (page === 1 ) {
                    page = 0
                    client.user.setActivity(`${body.ping} Ping`, {type: 'WATCHING'})
                    return
                }
            }).catch(err => {
                status = {}

                console.log(err)

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