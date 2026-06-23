const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const ReactionRoleSchema = require('../../models/ReactionRoleSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactionrole')
        .setDescription('Manage reaction roles.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Bind an emoji on a message to a role.')
                .addStringOption(option => option.setName('message_id').setDescription('ID of the message').setRequired(true))
                .addStringOption(option => option.setName('emoji').setDescription('Emoji to react with').setRequired(true))
                .addRoleOption(option => option.setName('role').setDescription('Role to assign').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove an emoji→role binding from a message.')
                .addStringOption(option => option.setName('message_id').setDescription('ID of the message').setRequired(true))
                .addStringOption(option => option.setName('emoji').setDescription('Emoji to remove').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all reaction role bindings in this server.')
        )
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('Post a custom reaction role embed in this channel.')
        ),

    permissions: PermissionFlagsBits.ManageRoles,

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            const messageId = interaction.options.getString('message_id');
            const emojiInput = interaction.options.getString('emoji');
            const role = interaction.options.getRole('role');

            // Parse custom emoji <:name:id> or animated <a:name:id>, otherwise treat as unicode
            const customMatch = emojiInput.match(/^<a?:\w+:(\d+)>$/);
            const emojiKey = customMatch ? customMatch[1] : emojiInput.trim();

            if (role.managed || role.id === interaction.guild.id)
                return interaction.reply({ content: 'That role cannot be assigned.', flags: MessageFlags.Ephemeral });

            if (interaction.guild.members.me.roles.highest.comparePositionTo(role) <= 0)
                return interaction.reply({ content: `My highest role is below **${role.name}** — I can't assign it.`, flags: MessageFlags.Ephemeral });

            const existing = await ReactionRoleSchema.findOne({
                guildId: interaction.guild.id,
                messageId,
                emoji: emojiKey,
            });

            if (existing)
                return interaction.reply({ content: 'That emoji is already bound to a role on that message.', flags: MessageFlags.Ephemeral });

            await ReactionRoleSchema.create({
                guildId: interaction.guild.id,
                messageId,
                emoji: emojiKey,
                roleId: role.id,
            });

            const message = await interaction.channel.messages.fetch(messageId).catch(() => null);
            if (message) await message.react(emojiInput).catch(() => null);

            return interaction.reply({
                content: `Done. Reacting with ${emojiInput} on message \`${messageId}\` will assign **${role.name}**.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        if (sub === 'remove') {
            const messageId = interaction.options.getString('message_id');
            const emojiInput = interaction.options.getString('emoji');

            const customMatch = emojiInput.match(/^<a?:\w+:(\d+)>$/);
            const emojiKey = customMatch ? customMatch[1] : emojiInput.trim();

            const deleted = await ReactionRoleSchema.findOneAndDelete({
                guildId: interaction.guild.id,
                messageId,
                emoji: emojiKey,
            });

            if (!deleted)
                return interaction.reply({ content: 'No binding found for that emoji on that message.', flags: MessageFlags.Ephemeral });

            return interaction.reply({ content: 'Binding removed.', flags: MessageFlags.Ephemeral });
        }

        if (sub === 'setup') {
            const modal = new ModalBuilder()
                .setCustomId(`rr_setup:${interaction.channelId}`)
                .setTitle('Reaction Role Embed');

            const titleInput = new TextInputBuilder()
                .setCustomId('rr_title')
                .setLabel('Title')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(256);

            const descInput = new TextInputBuilder()
                .setCustomId('rr_description')
                .setLabel('Description')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(4000);

            const colorInput = new TextInputBuilder()
                .setCustomId('rr_color')
                .setLabel('Color (hex e.g. #5865F2, blank = random)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(7);

            const footerInput = new TextInputBuilder()
                .setCustomId('rr_footer')
                .setLabel('Footer text (optional)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(2048);

            const thumbnailInput = new TextInputBuilder()
                .setCustomId('rr_thumbnail')
                .setLabel('Thumbnail URL (optional)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(1024);

            modal.addComponents(
                new ActionRowBuilder().addComponents(titleInput),
                new ActionRowBuilder().addComponents(descInput),
                new ActionRowBuilder().addComponents(colorInput),
                new ActionRowBuilder().addComponents(footerInput),
                new ActionRowBuilder().addComponents(thumbnailInput),
            );

            return interaction.showModal(modal);
        }

        if (sub === 'list') {
            const mappings = await ReactionRoleSchema.find({ guildId: interaction.guild.id });

            if (!mappings.length)
                return interaction.reply({ content: 'No reaction roles configured for this server.', flags: MessageFlags.Ephemeral });

            const lines = mappings.map(m => {
                const emojiDisplay = /^\d+$/.test(m.emoji)
                    ? `<:_:${m.emoji}>`
                    : m.emoji;
                return `${emojiDisplay} → <@&${m.roleId}> on \`${m.messageId}\``;
            });

            const embed = new EmbedBuilder()
                .setTitle('Reaction Roles')
                .setDescription(lines.join('\n'))
                .setColor(Math.floor(Math.random() * 0xFFFFFF));

            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    },
};