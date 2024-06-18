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

            }).then((body) => {
                status = body
                client.user.setStatus('online')
                if (page === 0) {(body.numplayers > 0)
                    page = 1
                    client.user.setActivity(`${body.numplayers} / ${body.maxplayers} Players`, { type: 'WATCHING' })
                    return
                }
                if (page === 1 ) {
                    page = 0
                    client.user.setActivity(`${body.ping} Ping`, {type: 'WATCHING'})
                    return
                }
            }).catch(err => {
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