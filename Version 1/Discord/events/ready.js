module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        console.log(`Discord Logged in as ${client.user.tag}!`);
    },
};