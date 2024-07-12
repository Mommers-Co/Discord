client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('!save')) {
        const data = message.content.split(' ').slice(1).join(' ');

        const databases = new appwrite.Databases(sdk);

        try {
            const response = await databases.createDocument('databaseId', 'collectionId', 'unique()', { message: data });
            message.reply('Data saved successfully!');
        } catch (error) {
            console.error(error);
            message.reply('Failed to save data.');
        }
    }
});
