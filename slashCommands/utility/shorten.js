const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shorten')
        .setDescription('Shortens a URL using is.gd.')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('The URL you want to shorten')
                .setRequired(true)),

    async execute(interaction) {
        const url = interaction.options.getString('url');

        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch {
            return interaction.reply({
                content: 'That doesn\'t look like a valid URL. Make sure to include `http://` or `https://`.',
                flags: MessageFlags.Ephemeral,
            });
        }

        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return interaction.reply({
                content: 'Only `http` and `https` URLs are supported.',
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply();

        try {
            const response = await axios.get('https://is.gd/create.php', {
                params: { format: 'json', url },
                timeout: 5000,
            });

            const shortUrl = response.data.shorturl;
            if (!shortUrl) {
                return interaction.editReply({ content: 'Failed to shorten the URL. The service may have rejected it.', flags: MessageFlags.Ephemeral });
            }

            await interaction.editReply(`Here's your shortened URL:\n**${shortUrl}**\n\n> Original: <${url}>`);
        } catch (error) {
            console.error('[shorten] Error:', error);
            await interaction.editReply('Something went wrong while shortening the URL. Please try again later.');
        }
    },
};