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
                type: 'palworld',
                host: '103.152.196.49',
                port: 8226,
                maxRetries: 3,
                socketTimeout: 2000,
                debug: true
            }).then((body) => {
                status = body
                client.user.setStatus('online')
                if (page === 0) {(body.raw.vanilla.numplayers > 0)
                    page = 1
                    client.user.setActivity(`${body.raw.vanilla.numplayers} / ${body.raw.vanilla.maxplayers} Players`, { type: 'WATCHING' })
                    return
                }
                if (page === 1 ) {
                    page = 0
                    client.user.setActivity(`${body.ping} Ping`, {type: 'WATCHING'})
                    return
                }
            }).catch(err => console.log{
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