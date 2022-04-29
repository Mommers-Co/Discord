const { Client, Intents } = require('discord.js');
const { guildId, token } = require('./config.json');

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

// When the client is ready, run this code (only once)
client.once('ready', () => {
    console.log(`Discord Logged in as ${client.user.tag}!`)
    async function Update() {
    client.user.setActivity(`${client.guilds.cache.get('969241414561062943').memberCount} Members`, {type: "WATCHING"})
    }
    setInterval(Update, 1000 * 60), Update()
});

client.on('interactionCreate', interaction => {
    
    if (interaction.isCommand()) return require(`./commands/SlashCommands/${interaction.commandName}.js`)(interaction)
})

// Login to Discord with your client's token
client.login(token);