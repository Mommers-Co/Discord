const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent] });
client.commands = new Map();

// Load configuration
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

function updateMemberStatus() {
    const memberCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    client.user.setActivity(`with ${memberCount} members | ${config.prefix}help`, { type: 'PLAYING' });
}

// Load commands from the commands directory
const commandsDir = path.join(__dirname, 'commands');

if (fs.existsSync(commandsDir)) {
    const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(path.join(commandsDir, file));
        client.commands.set(command.name, command);
    }
} else {
    console.warn(`Commands directory not found: ${commandsDir}`);
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    updateMemberStatus(); // Update status on bot startup
});

client.on('guildMemberAdd', () => {
    updateMemberStatus(); // Update status when a member joins
});

client.on('guildMemberRemove', () => {
    updateMemberStatus(); // Update status when a member leaves
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.content.startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
        await command.execute(message, args);
    } catch (error) {
        console.error('Error executing command:', error);
        message.reply('There was an error executing that command.');
    }
});

module.exports = { client, updateMemberStatus };
