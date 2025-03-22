import { SlashCommandBuilder } from "discord.js";

export default async (client: any) => {
    // You can set up additional functionality if needed
};

export const commands = [
    {
        data: new SlashCommandBuilder()
            .setName('hello')
            .setDescription('Replies with a hello message!'),
        async execute(interaction: any) {
            await interaction.reply('Hello, world!');
        },
    },
];
