require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const appwrite = require('node-appwrite');
process.env = require('./config.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', () => {
    async function Update () {
        client.user.setActivity(`${client.guilds.cache.get(process.env.discord.guildId).memberCount} Members`, {type: "WATCHING"})
    }
    setInterval(Update, 1000 * 60), Update()
    console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.discord.token);
