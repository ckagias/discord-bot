const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { isValidUrl } = require('../../utils/validate');
const { parseHexColor } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Build and post a custom embed.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Open the embed builder form and post to a channel.')
                .addChannelOption(o =>
                    o.setName('channel')
                        .setDescription('Channel to post the embed in (defaults to current channel)')
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('edit')
                .setDescription('Edit an existing embed posted by the bot.')
                .addStringOption(o =>
                    o.setName('message_id')
                        .setDescription('Message ID of the embed to edit')
                        .setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('help')
                .setDescription('Show all formatting options you can use in embed descriptions.')
        ),

    permissions: PermissionFlagsBits.ManageMessages,

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'create') {
            const channel = interaction.options.getChannel('channel') ?? interaction.channel;

            if (!channel.isTextBased())
                return interaction.reply({ content: 'That channel is not a text channel.', flags: MessageFlags.Ephemeral });

            const botMember = interaction.guild.members.me;
            if (!channel.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages))
                return interaction.reply({ content: `I don't have permission to send messages in ${channel}.`, flags: MessageFlags.Ephemeral });

            return interaction.showModal(buildMainModal(`embed_create:${channel.id}`));
        }

        if (sub === 'edit') {
            const messageId = interaction.options.getString('message_id');
            const message = await interaction.channel.messages.fetch(messageId).catch(() => null);

            if (!message)
                return interaction.reply({ content: 'Could not find that message in this channel.', flags: MessageFlags.Ephemeral });
            if (message.author.id !== interaction.client.user.id)
                return interaction.reply({ content: 'I can only edit messages that I posted.', flags: MessageFlags.Ephemeral });
            if (!message.embeds.length)
                return interaction.reply({ content: 'That message has no embed to edit.', flags: MessageFlags.Ephemeral });

            const existing = message.embeds[0];
            return interaction.showModal(buildMainModal(`embed_edit:${interaction.channelId}:${messageId}`, existing));
        }

        if (sub === 'help') {
            const embed = new EmbedBuilder()
                .setTitle('Embed Formatting Guide')
                .setColor(0x5865F2)
                .setDescription('Everything below works inside the **Description** field of `/embed create`.')
                .addFields(
                    {
                        name: 'Text Formatting',
                        value: [
                            '`**bold**` → **bold**',
                            '`*italic*` → *italic*',
                            '`__underline__` → __underline__',
                            '`~~strikethrough~~` → ~~strikethrough~~',
                            '`***bold italic***` → ***bold italic***',
                        ].join('\n'),
                        inline: true,
                    },
                    {
                        name: 'Code',
                        value: [
                            '`` `inline code` `` → `inline code`',
                            '` ```code block``` ` → multiline code block',
                            '` ```js your code ``` ` → syntax highlighted',
                        ].join('\n'),
                        inline: true,
                    },
                    { name: '​', value: '​', inline: false },
                    {
                        name: 'Headings & Quotes',
                        value: [
                            '`# Heading` → large heading',
                            '`## Subheading` → medium heading',
                            '`### Small` → small heading',
                            '`> text` → block quote',
                            '`>>> text` → multi-line block quote',
                        ].join('\n'),
                        inline: true,
                    },
                    {
                        name: 'Lists',
                        value: [
                            '`- item` → bullet list',
                            '`1. item` → numbered list',
                            '`  - item` → nested bullet (2 spaces)',
                        ].join('\n'),
                        inline: true,
                    },
                    { name: '​', value: '​', inline: false },
                    {
                        name: 'Links & Mentions',
                        value: [
                            '`[text](https://url.com)` → clickable link',
                            '`<@userId>` → mention a user',
                            '`<#channelId>` → link a channel',
                            '`<@&roleId>` → mention a role',
                        ].join('\n'),
                        inline: true,
                    },
                    {
                        name: 'Timestamps',
                        value: [
                            '`<t:UNIX:R>` → "3 hours ago"',
                            '`<t:UNIX:F>` → "June 15 2026 at 12:00"',
                            '`<t:UNIX:D>` → "June 15 2026"',
                            '`<t:UNIX:T>` → "12:00 PM"',
                            'Get UNIX time at **epochconverter.com**',
                        ].join('\n'),
                        inline: true,
                    },
                    { name: '​', value: '​', inline: false },
                    {
                        name: 'Fields (Step 2 of /embed create)',
                        value: [
                            'Each line = one field:',
                            '`Field Name | Field Value | yes` → inline (side by side)',
                            '`Field Name | Field Value | no` → full width',
                            'Leave blank to skip fields entirely.',
                        ].join('\n'),
                        inline: false,
                    },
                    {
                        name: '⚠️ Does NOT work in Footer',
                        value: 'The footer is **plain text only** — no markdown renders there.',
                        inline: false,
                    },
                )
                .setFooter({ text: 'Use /embed create to open the builder' });

            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    },
};

function buildMainModal(customId, existing = null) {
    const modal = new ModalBuilder()
        .setCustomId(customId)
        .setTitle(existing ? 'Edit Embed (1/2)' : 'Create Embed (1/2)');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('embed_title')
                .setLabel('Title (optional)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(256)
                .setValue(existing?.title ?? '')
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('embed_description')
                .setLabel('Description (optional)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(4000)
                .setValue(existing?.description ?? '')
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('embed_color')
                .setLabel('Color (hex e.g. #5865F2, blank = random)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(7)
                .setValue(existing?.hexColor ?? '')
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('embed_footer')
                .setLabel('Footer text (optional)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(2048)
                .setValue(existing?.footer?.text ?? '')
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('embed_image')
                .setLabel('Image URL (optional)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(1024)
                .setValue(existing?.image?.url ?? '')
        ),
    );

    return modal;
}

function buildFieldsModal(customId, existingFields = []) {
    const modal = new ModalBuilder()
        .setCustomId(customId)
        .setTitle('Embed Fields (2/2 — optional)');

    const hint = 'Name | Value | yes/no (inline)\nLeave blank to skip fields.';

    const inputs = [1, 2, 3, 4, 5].map((n, i) => {
        const existing = existingFields[i];
        return new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId(`embed_field_${n}`)
                .setLabel(`Field ${n} (Name | Value | yes/no)`)
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(300)
                .setPlaceholder(i === 0 ? hint : 'e.g. Rules | Be respectful | no')
                .setValue(existing ? `${existing.name} | ${existing.value} | ${existing.inline ? 'yes' : 'no'}` : '')
        );
    });

    modal.addComponents(...inputs);
    return modal;
}

function parseMainFields(interaction) {
    const title       = interaction.fields.getTextInputValue('embed_title').trim();
    const description = interaction.fields.getTextInputValue('embed_description').trim();
    const colorRaw    = interaction.fields.getTextInputValue('embed_color').trim();
    const footerText  = interaction.fields.getTextInputValue('embed_footer').trim();
    const imageUrl    = interaction.fields.getTextInputValue('embed_image').trim();

    const { color, error } = parseHexColor(colorRaw);
    if (error) return { error };

    if (imageUrl && !isValidUrl(imageUrl))
        return { error: 'Invalid image URL.' };

    return { title, description, color, footerText, imageUrl };
}

function parseFieldLines(interaction) {
    const fields = [];
    for (let n = 1; n <= 5; n++) {
        const raw = interaction.fields.getTextInputValue(`embed_field_${n}`).trim();
        if (!raw) continue;

        const parts = raw.split('|').map(p => p.trim());
        if (parts.length < 2) continue;

        const name   = parts[0].slice(0, 256);
        const value  = parts[1].slice(0, 1024);
        const inline = parts[2]?.toLowerCase() === 'yes';

        if (!name || !value) continue;
        fields.push({ name, value, inline });
    }
    return fields;
}

function buildEmbed({ title, description, color, footerText, imageUrl }, fields = []) {
    const embed = new EmbedBuilder().setColor(color);
    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (footerText) embed.setFooter({ text: footerText });
    if (imageUrl) embed.setImage(imageUrl);
    if (fields.length) embed.addFields(fields);
    return embed;
}

module.exports.buildFieldsModal = buildFieldsModal;
module.exports.parseMainFields  = parseMainFields;
module.exports.parseFieldLines  = parseFieldLines;
module.exports.buildEmbed       = buildEmbed;
