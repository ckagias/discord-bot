const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { randomUUID } = require('node:crypto');
const { formatBalance } = require('../../utils/economy');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ShopSchema = require('../../models/ShopSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shopmanage')
        .setDescription('Manage the server shop.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add an item to the shop')
                .addStringOption(opt =>
                    opt.setName('name').setDescription('Item name').setRequired(true))
                .addIntegerOption(opt =>
                    opt.setName('price').setDescription('Price in coins').setRequired(true).setMinValue(1))
                .addStringOption(opt =>
                    opt.setName('type').setDescription('Item type').setRequired(true)
                        .addChoices(
                            { name: 'Role (grants a Discord role)', value: 'role' },
                            { name: 'Badge (emoji shown on /profile)', value: 'badge' },
                        ))
                .addStringOption(opt =>
                    opt.setName('description').setDescription('Short description shown in the shop').setRequired(false))
                .addRoleOption(opt =>
                    opt.setName('role').setDescription('Role to grant (required for type: role)').setRequired(false))
                .addStringOption(opt =>
                    opt.setName('emoji').setDescription('Emoji to display (required for type: badge)').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove an item from the shop')
                .addStringOption(opt =>
                    opt.setName('item').setDescription('Item to remove').setRequired(true).setAutocomplete(true)))
        .addSubcommand(sub =>
            sub.setName('edit')
                .setDescription('Edit an existing shop item')
                .addStringOption(opt =>
                    opt.setName('item').setDescription('Item to edit').setRequired(true).setAutocomplete(true))
                .addStringOption(opt =>
                    opt.setName('name').setDescription('New name').setRequired(false))
                .addIntegerOption(opt =>
                    opt.setName('price').setDescription('New price').setRequired(false).setMinValue(1))
                .addStringOption(opt =>
                    opt.setName('description').setDescription('New description').setRequired(false))
                .addBooleanOption(opt =>
                    opt.setName('enabled').setDescription('Show/hide item in the shop').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all shop items including hidden ones')),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused().toLowerCase();
        const items = await ShopSchema.find({ guildId: interaction.guild.id });
        const choices = items
            .filter(i => i.name.toLowerCase().includes(focused))
            .slice(0, 25)
            .map(i => ({ name: `${i.name}${i.enabled ? '' : ' [hidden]'} — ${formatBalance(i.price)} coins`, value: i.itemId }));
        await interaction.respond(choices);
    },

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            const name = interaction.options.getString('name');
            const price = interaction.options.getInteger('price');
            const type = interaction.options.getString('type');
            const description = interaction.options.getString('description') ?? '';
            const role = interaction.options.getRole('role');
            const emoji = interaction.options.getString('emoji');

            if (type === 'role' && !role) {
                return interaction.editReply({ content: 'You must provide a **role** for type `role`.' });
            }
            if (type === 'badge' && !emoji) {
                return interaction.editReply({ content: 'You must provide an **emoji** for type `badge`.' });
            }

            // Prevent duplicate names per guild
            const existing = await ShopSchema.findOne({ guildId: interaction.guild.id, name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } });
            if (existing) {
                return interaction.editReply({ content: `An item named **${name}** already exists in the shop.` });
            }

            await ShopSchema.create({
                guildId: interaction.guild.id,
                itemId: randomUUID(),
                name,
                description,
                price,
                type,
                roleId: role?.id ?? null,
                emoji: emoji ?? null,
            });

            return interaction.editReply({ content: `✅ Added **${name}** (${type}) for ${formatBalance(price)} coins.` });
        }

        if (sub === 'remove') {
            const itemId = interaction.options.getString('item');
            const item = await ShopSchema.findOneAndDelete({ itemId, guildId: interaction.guild.id });
            if (!item) return interaction.editReply({ content: 'Item not found.' });

            return interaction.editReply({ content: `✅ Removed **${item.name}** from the shop. Existing owners keep their item.` });
        }

        if (sub === 'edit') {
            const itemId = interaction.options.getString('item');
            const item = await ShopSchema.findOne({ itemId, guildId: interaction.guild.id });
            if (!item) return interaction.editReply({ content: 'Item not found.' });

            const name = interaction.options.getString('name');
            const price = interaction.options.getInteger('price');
            const description = interaction.options.getString('description');
            const enabled = interaction.options.getBoolean('enabled');

            if (name !== null) item.name = name;
            if (price !== null) item.price = price;
            if (description !== null) item.description = description;
            if (enabled !== null) item.enabled = enabled;

            await item.save();
            return interaction.editReply({ content: `✅ Updated **${item.name}**.` });
        }

        if (sub === 'list') {
            const items = await ShopSchema.find({ guildId: interaction.guild.id });
            if (!items.length) return interaction.editReply({ content: 'No items in the shop yet.' });

            const lines = items.map(i => {
                const status = i.enabled ? '🟢' : '🔴';
                const typeTag = i.type === 'badge' ? `${i.emoji} badge` : 'role';
                return `${status} **${i.name}** (${typeTag}) — ${formatBalance(i.price)} coins`;
            });

            const embed = new EmbedBuilder()
                .setTitle('Shop Items')
                .setDescription(lines.join('\n'))
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setFooter({ text: '🟢 visible  🔴 hidden' });

            return interaction.editReply({ embeds: [embed] });
        }
    },
};
