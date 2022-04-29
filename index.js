const fs = require(`node:fs`);
const { Client, Collection, Intents } = require('discord.js');
const { guildId, token } = require('./config.json');
const dotenv = require('dotenv');
dotenv.config();

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

client.once('ready', () => {
    async function Update() {
    client.user.setActivity(`${client.guilds.cache.get(guildId).memberCount} Members`, {type: "WATCHING"})
    }
    setInterval(Update, 1000 * 60), Update()
});

client.commands = new Collection();
    const commandFiles = fs.readdirSync(`./commands/SlashCommands/`).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(`./commands/SlashCommands/${file}`);
        client.commands.set(command.data.name, command);
    }

const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const event = require(`./events/${file}`);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const command = client.commands.get(interaction.commandName);

	if (!command) return;

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});

client.login(token);