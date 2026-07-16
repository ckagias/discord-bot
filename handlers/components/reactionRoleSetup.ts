import { EmbedBuilder, MessageFlags, ModalSubmitInteraction } from 'discord.js';
import { isValidUrl } from '../../utils/validate';
import { parseHexColor } from '../../utils/embeds';
import { ComponentDefinition } from '../../types/discord';

const component: ComponentDefinition = {
    type: 'modal',
    prefix: 'rr_setup:',

    async execute(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const channelId = interaction.customId.split(':')[1];
        const channel = await interaction.guild!.channels.fetch(channelId).catch(() => null);
        if (!channel)
            return interaction.editReply({ content: 'Could not find the channel. Please try again.' });

        const title       = interaction.fields.getTextInputValue('rr_title');
        const description = interaction.fields.getTextInputValue('rr_description');
        const colorRaw    = interaction.fields.getTextInputValue('rr_color').trim();
        const footerText  = interaction.fields.getTextInputValue('rr_footer').trim();
        const thumbnail   = interaction.fields.getTextInputValue('rr_thumbnail').trim();

        const { color, error } = parseHexColor(colorRaw);
        if (error) return interaction.editReply({ content: error });

        if (thumbnail && !isValidUrl(thumbnail))
            return interaction.editReply({ content: 'Invalid thumbnail URL.' });

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color);

        if (footerText) embed.setFooter({ text: footerText });
        if (thumbnail)  embed.setThumbnail(thumbnail);

        const sent = await (channel as any).send({ embeds: [embed] });

        return interaction.editReply({
            content: `Embed posted. Message ID: \`${sent.id}\`\nUse \`/reactionrole add\` with this ID to bind emojis to roles.`,
        });
    },
};

export = component;
