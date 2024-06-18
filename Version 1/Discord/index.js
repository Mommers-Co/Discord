const fs = require(`node:fs`);
process.env = require('./config.json');
process.data = {
	games: {}
}

const { Client, Collection, Intents } = require('discord.js')
var selectedIntents = []
for (intent in Intents.FLAGS) { selectedIntents.push(Intents.FLAGS[intent]) }
const client = new Client({ intents: selectedIntents })
client.login(process.env.discord.token)
process.client = client

for (game in process.env.games) {
    if (process.env.games[game]) require(`./Bots/${game}.js`).Start(process.env.games[game], game)
}

client.once('ready', () => {
    async function Update() {
    client.user.setActivity(`${client.guilds.cache.get(process.env.discord.guildId).memberCount} Members`, {type: "WATCHING"})
    }
    setInterval(Update, 1000 * 60), Update()
});

/*
module.exports = client;

const logs = require('discord-logs');
logs(client, {
    debug: true
});
*/

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

	const command = client.commands.get(interaction.command.data.name);

	if (!command) return;

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});

/*
client.on('messageDelete', async message => {	
	if (!message.guild) return;
		const fetchedLogs = await message.guild.fetchAuditLogs({
			limit: 1,
			type: 'MESSAGE_DELETE',
		});
	
		const deletionLog = fetchedLogs.entries.first();
	
		if (!deletionLog) return console.log(`A message by ${message.author.tag} was deleted, but no relevant audit logs were found.`);
	
		const { executor, target } = deletionLog;
		if (target.id === message.author.id) {
			console.log(`Message ${message.author.tag} was deleted by ${executor.tag}.`);
			} else {
				console.log(`Message by ${message.author.tag} was deleted, but unknown.`);
		}
	});
*/