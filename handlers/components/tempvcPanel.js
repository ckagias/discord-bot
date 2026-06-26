const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    PermissionFlagsBits,
} = require('discord.js');

// Reads whether @everyone's Connect is denied to determine locked state.
function isChannelLocked(channel) {
    const overwrite = channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id);
    return overwrite?.deny.has(PermissionFlagsBits.Connect) ?? false;
}

function buildPanel(channel) {
    const locked = isChannelLocked(channel);
    const limit = channel.userLimit === 0 ? 'Unlimited' : `${channel.userLimit}`;

    const embed = new EmbedBuilder()
        .setColor(Math.floor(Math.random() * 0xFFFFFF))
        .setTitle('🎙️ Voice Channel Controls')
        .setDescription(`**${channel.name}**`)
        .addFields(
            { name: 'Status', value: locked ? '🔒 Locked' : '🔓 Open', inline: true },
            { name: 'User Limit', value: limit, inline: true },
        )
        .setFooter({ text: 'Only the channel owner can use these controls.' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`tempvc_rename:${channel.id}`)
            .setLabel('Rename')
            .setEmoji('✏️')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tempvc_lock:${channel.id}`)
            .setLabel(locked ? 'Unlock' : 'Lock')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`tempvc_limit:${channel.id}`)
            .setLabel('Set Limit')
            .setEmoji('👥')
            .setStyle(ButtonStyle.Secondary),
    );

    return { embeds: [embed], components: [row] };
}

// Returns the channel if the interaction caller is the owner, or replies ephemerally and returns null.
async function guardOwner(interaction) {
    const channelId = interaction.customId.split(':')[1];
    const ownerId = interaction.client.tempVCs?.get(channelId);

    if (!ownerId) {
        await interaction.reply({ content: 'This is no longer an active temp VC.', flags: MessageFlags.Ephemeral });
        return null;
    }

    if (ownerId !== interaction.user.id) {
        await interaction.reply({ content: 'Only the channel owner can manage this VC.', flags: MessageFlags.Ephemeral });
        return null;
    }

    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) {
        await interaction.reply({ content: 'Channel not found.', flags: MessageFlags.Ephemeral });
        return null;
    }

    return channel;
}

async function handleRenameButton(interaction) {
    const channel = await guardOwner(interaction);
    if (!channel) return;

    const modal = new ModalBuilder()
        .setCustomId(`tempvc_rename:${channel.id}`)
        .setTitle('Rename Voice Channel')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('name')
                    .setLabel('New channel name')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(100)
                    .setRequired(true)
                    .setValue(channel.name),
            ),
        );

    await interaction.showModal(modal);
}

async function handleLockToggle(interaction) {
    const channel = await guardOwner(interaction);
    if (!channel) return;

    const locked = isChannelLocked(channel);
    try {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
            [PermissionFlagsBits.Connect]: locked ? null : false,
        });
        await interaction.update(buildPanel(channel));
    } catch (err) {
        console.error('[tempvc] Lock toggle error:', err);
        await interaction.reply({ content: 'Failed to update channel permissions.', flags: MessageFlags.Ephemeral });
    }
}

async function handleLimitButton(interaction) {
    const channel = await guardOwner(interaction);
    if (!channel) return;

    const modal = new ModalBuilder()
        .setCustomId(`tempvc_limit:${channel.id}`)
        .setTitle('Set User Limit')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('limit')
                    .setLabel('Max members (0 = unlimited, max 99)')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(2)
                    .setRequired(true)
                    .setValue(`${channel.userLimit}`),
            ),
        );

    await interaction.showModal(modal);
}

async function handleRenameModal(interaction) {
    const channelId = interaction.customId.split(':')[1];
    const ownerId = interaction.client.tempVCs?.get(channelId);

    if (!ownerId) return interaction.reply({ content: 'This is no longer an active temp VC.', flags: MessageFlags.Ephemeral });
    if (ownerId !== interaction.user.id) return interaction.reply({ content: 'Only the channel owner can manage this VC.', flags: MessageFlags.Ephemeral });

    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) return interaction.reply({ content: 'Channel not found.', flags: MessageFlags.Ephemeral });

    const name = interaction.fields.getTextInputValue('name').trim();
    if (!name) return interaction.reply({ content: 'Name cannot be empty.', flags: MessageFlags.Ephemeral });

    try {
        await channel.setName(name);
        // Update the panel message in the channel.
        const messages = await channel.messages.fetch({ limit: 20 });
        const panelMsg = messages.find(m => m.author.id === interaction.client.user.id && m.components.length > 0);
        const panel = buildPanel(channel);
        if (panelMsg) {
            await panelMsg.edit(panel);
            await interaction.reply({ content: `Channel renamed to **${name}**.`, flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ content: `Channel renamed to **${name}**.`, flags: MessageFlags.Ephemeral });
        }
    } catch (err) {
        console.error('[tempvc] Rename error:', err);
        await interaction.reply({ content: 'Failed to rename the channel.', flags: MessageFlags.Ephemeral });
    }
}

async function handleLimitModal(interaction) {
    const channelId = interaction.customId.split(':')[1];
    const ownerId = interaction.client.tempVCs?.get(channelId);

    if (!ownerId) return interaction.reply({ content: 'This is no longer an active temp VC.', flags: MessageFlags.Ephemeral });
    if (ownerId !== interaction.user.id) return interaction.reply({ content: 'Only the channel owner can manage this VC.', flags: MessageFlags.Ephemeral });

    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) return interaction.reply({ content: 'Channel not found.', flags: MessageFlags.Ephemeral });

    const raw = interaction.fields.getTextInputValue('limit').trim();
    const limit = parseInt(raw, 10);
    if (isNaN(limit) || limit < 0 || limit > 99) {
        return interaction.reply({ content: 'Please enter a number between 0 and 99 (0 = unlimited).', flags: MessageFlags.Ephemeral });
    }

    try {
        await channel.setUserLimit(limit);
        const messages = await channel.messages.fetch({ limit: 20 });
        const panelMsg = messages.find(m => m.author.id === interaction.client.user.id && m.components.length > 0);
        const panel = buildPanel(channel);
        if (panelMsg) {
            await panelMsg.edit(panel);
            await interaction.reply({ content: `User limit set to **${limit === 0 ? 'unlimited' : limit}**.`, flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ content: `User limit set to **${limit === 0 ? 'unlimited' : limit}**.`, flags: MessageFlags.Ephemeral });
        }
    } catch (err) {
        console.error('[tempvc] Limit error:', err);
        await interaction.reply({ content: 'Failed to update the user limit.', flags: MessageFlags.Ephemeral });
    }
}

const entries = [
    { type: 'button', prefix: 'tempvc_rename:', execute: handleRenameButton },
    { type: 'button', prefix: 'tempvc_lock:',   execute: handleLockToggle },
    { type: 'button', prefix: 'tempvc_limit:',  execute: handleLimitButton },
    { type: 'modal',  prefix: 'tempvc_rename:', execute: handleRenameModal },
    { type: 'modal',  prefix: 'tempvc_limit:',  execute: handleLimitModal },
];

entries.buildPanel = buildPanel;
module.exports = entries;
