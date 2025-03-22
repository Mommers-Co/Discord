import { SlashCommandBuilder } from "discord.js";

export default async (client: any) => {};

export const commands = [
    {
        data: new SlashCommandBuilder()
            .setName('ping')
            .setDescription('Replies with Pong!'),
        async execute(interaction: any) {
            await interaction.reply('Pong!');
        },
    },
];
