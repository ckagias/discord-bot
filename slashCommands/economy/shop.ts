import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
const { getWallet, updateBalance, formatBalance } = require('../../utils/economy');
const ShopSchema = require('../../models/ShopSchema');
const InventorySchema = require('../../models/InventorySchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Browse or buy items from the server shop.')
        .addSubcommand(sub =>
            sub.setName('browse')
                .setDescription('Browse all available items in the shop'))
        .addSubcommand(sub =>
            sub.setName('buy')
                .setDescription('Buy an item from the shop')
                .addStringOption(opt =>
                    opt.setName('item')
                        .setDescription('Item name to buy')
                        .setRequired(true)
                        .setAutocomplete(true)))
        .addSubcommand(sub =>
            sub.setName('sell')
                .setDescription('Sell an item from your inventory for 50% of its original price')
                .addStringOption(opt =>
                    opt.setName('item')
                        .setDescription('Item to sell')
                        .setRequired(true)
                        .setAutocomplete(true))),

    async autocomplete(interaction: AutocompleteInteraction) {
        const focused = interaction.options.getFocused().toLowerCase();
        const sub = interaction.options.getSubcommand(false);

        if (sub === 'sell') {
            const inv = await InventorySchema.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
            const owned = inv?.items ?? [];
            const choices = owned
                .filter(i => i.name.toLowerCase().includes(focused))
                .slice(0, 25)
                .map(i => ({ name: i.name, value: i.itemId }));
            return interaction.respond(choices);
        }

        const items = await ShopSchema.find({ guildId: interaction.guild.id, enabled: true });
        const choices = items
            .filter(i => i.name.toLowerCase().includes(focused))
            .slice(0, 25)
            .map(i => ({ name: `${i.name} — ${formatBalance(i.price)} coins`, value: i.itemId }));
        await interaction.respond(choices);
    },

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const sub = interaction.options.getSubcommand();

        if (sub === 'browse') {
            const items = await ShopSchema.find({ guildId: interaction.guild.id, enabled: true });

            if (!items.length) {
                return interaction.editReply({ content: 'The shop is empty. An admin can add items with `/shopmanage add`.' });
            }

            const lines = items.map(item => {
                const typeTag = item.type === 'badge' ? `${item.emoji} Badge` : 'Role';
                const desc = item.description ? ` — ${item.description}` : '';
                return `**${item.name}** (${typeTag})${desc}\n> 💰 ${formatBalance(item.price)} coins`;
            });

            const embed = new EmbedBuilder()
                .setTitle(`${interaction.guild.name} Shop`)
                .setDescription(lines.join('\n\n'))
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setFooter({ text: `Buy an item with /shop buy • ${items.length} item(s) available` });

            return interaction.editReply({ embeds: [embed] });
        }

        if (sub === 'sell') {
            const itemId = interaction.options.getString('item');
            const inv = await InventorySchema.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
            const ownedItem = inv?.items.find(i => i.itemId === itemId);
            if (!ownedItem) return interaction.editReply({ content: "You don't own that item." });

            // Look up current shop price (item may have been removed; refund based on last known price or 0)
            const shopItem = await ShopSchema.findOne({ itemId, guildId: interaction.guild.id });
            const refund = shopItem ? Math.floor(shopItem.price * 0.5) : 0;

            // Credit coins before removing from inventory — prevents partial failure leaving user with neither
            const updated = refund > 0 ? await updateBalance(interaction.user.id, interaction.guild.id, refund) : await getWallet(interaction.user.id, interaction.guild.id);

            await InventorySchema.updateOne(
                { userId: interaction.user.id, guildId: interaction.guild.id },
                { $pull: { items: { itemId } } }
            );

            if (ownedItem.type === 'role' && shopItem?.roleId) {
                const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
                if (member) await member.roles.remove(shopItem.roleId).catch(() => null);
            }

            const embed = new EmbedBuilder()
                .setTitle('Item Sold')
                .setDescription(
                    refund > 0
                        ? `You sold **${ownedItem.name}** and received **${formatBalance(refund)} coins** (50% of original price).`
                        : `You removed **${ownedItem.name}** from your inventory. No refund — the item is no longer in the shop.`
                )
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setFooter({ text: `New balance: ${formatBalance(updated.balance)} coins` });

            return interaction.editReply({ embeds: [embed] });
        }

        const itemId = interaction.options.getString('item');
        const item = await ShopSchema.findOne({ itemId, guildId: interaction.guild.id, enabled: true });
        if (!item) return interaction.editReply({ content: 'That item does not exist or is no longer available.' });

        // Atomically add to inventory only if not already owned — prevents double-buy race
        const inventoryResult = await InventorySchema.findOneAndUpdate(
            { userId: interaction.user.id, guildId: interaction.guild.id, 'items.itemId': { $ne: item.itemId } },
            { $push: { items: { itemId: item.itemId, name: item.name, type: item.type, emoji: item.emoji } } },
            { upsert: true, returnDocument: 'after' }
        ).catch(() => null);

        if (!inventoryResult) {
            return interaction.editReply({ content: `You already own **${item.name}**.` });
        }

        // Deduct coins — if this fails (insufficient funds), roll back the inventory entry
        const updated = await updateBalance(interaction.user.id, interaction.guild.id, -item.price);
        if (!updated) {
            await InventorySchema.updateOne(
                { userId: interaction.user.id, guildId: interaction.guild.id },
                { $pull: { items: { itemId: item.itemId } } }
            );
            const wallet = await getWallet(interaction.user.id, interaction.guild.id);
            return interaction.editReply({
                content: `You don't have enough coins. **${item.name}** costs ${formatBalance(item.price)} coins and your balance is ${formatBalance(wallet.balance)}.`,
            });
        }

        if (item.type === 'role' && item.roleId) {
            const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            if (member) {
                const roleGranted = await member.roles.add(item.roleId).catch(() => null);
                if (roleGranted === null) {
                    // Role grant failed (permissions/hierarchy) — refund and remove from inventory
                    await updateBalance(interaction.user.id, interaction.guild.id, item.price);
                    await InventorySchema.updateOne(
                        { userId: interaction.user.id, guildId: interaction.guild.id },
                        { $pull: { items: { itemId: item.itemId } } }
                    );
                    return interaction.editReply({ content: `Purchase failed: I don't have permission to grant the **${item.name}** role. Your coins have been refunded.` });
                }
            }
        }

        const typeNote = item.type === 'role'
            ? 'The role has been granted to you.'
            : `The badge **${item.emoji}** will appear on your \`/profile\`.`;

        const embed = new EmbedBuilder()
            .setTitle('Purchase Successful!')
            .setDescription(`You bought **${item.name}** for **${formatBalance(item.price)} coins**.\n${typeNote}`)
            .setColor(0x538d4e)
            .setFooter({ text: `New balance: ${formatBalance(updated.balance)} coins` });

        return interaction.editReply({ embeds: [embed] });
    },
};
