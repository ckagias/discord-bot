import { SlashCommandBuilder, ChannelType, PermissionFlagsBits, MessageFlags, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { buildPanel } from '../../handlers/components/tempvcPanel';
import { getGuildConfig, updateGuildConfig } from '../../utils/guildConfig';
const log = require('../../utils/log');
const logger = log.scope('tempvc');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tempvc')
        .setDescription('Manage temporary voice channels.')
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Create a temporary voice channel')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the voice channel')
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('locked')
                        .setDescription('Lock the channel so only invited members can join')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('limit')
                        .setDescription('Max number of members (2–99, leave empty for unlimited)')
                        .setRequired(false)
                        .setMinValue(2)
                        .setMaxValue(99)))
        .addSubcommand(sub =>
            sub.setName('invite')
                .setDescription('Invite a user to your locked temp VC')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to invite')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('Set the category where temp VCs are created (Manage Server).')
                .addChannelOption(option =>
                    option.setName('category')
                        .setDescription('The category to create temp VCs in (leave empty to clear).')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false))),

    async execute(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();
        const member = interaction.member as GuildMember;

        if (sub === 'setup') {
            if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: 'You need the **Manage Server** permission to configure temp VCs.', flags: MessageFlags.Ephemeral });
            }

            const category = interaction.options.getChannel('category');
            await updateGuildConfig(interaction.guild.id, { tempVcCategoryId: category?.id ?? null });

            return interaction.reply({
                content: category
                    ? `Temp VCs will now be created in the **${category.name}** category.`
                    : 'Temp VC category cleared — channels will be created in the same category as the caller.',
                flags: MessageFlags.Ephemeral,
            });
        }

        if (sub === 'create') {
            const voiceChannel = member.voice.channel;
            if (!voiceChannel) {
                return interaction.reply({ content: 'You must be in a voice channel to create a temp VC.', flags: MessageFlags.Ephemeral });
            }

            const name = interaction.options.getString('name');
            const locked = interaction.options.getBoolean('locked') ?? false;
            const limit = interaction.options.getInteger('limit') ?? 0;

            const config = await getGuildConfig(interaction.guild.id);
            const parentId = config?.tempVcCategoryId ?? voiceChannel.parentId;

            const permissionOverwrites = [
                {
                    id: interaction.guild.roles.everyone,
                    deny: locked ? [PermissionFlagsBits.Connect] : [],
                },
                {
                    id: member.id,
                    allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels],
                },
                {
                    id: interaction.client.user.id,
                    allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.MoveMembers],
                },
            ];

            let tempChannel;
            try {
                tempChannel = await interaction.guild.channels.create({
                    name,
                    type: ChannelType.GuildVoice,
                    parent: parentId,
                    userLimit: limit,
                    permissionOverwrites,
                });
            } catch (error) {
                logger.error('Channel creation error:', error);
                return interaction.reply({ content: 'Failed to create the voice channel. Make sure I have the **Manage Channels** permission.', flags: MessageFlags.Ephemeral });
            }

            if (!interaction.client.tempVCs) interaction.client.tempVCs = new Map();
            interaction.client.tempVCs.set(tempChannel.id, member.id);

            await member.voice.setChannel(tempChannel).catch(err => {
                logger.error('Failed to move member:', err);
            });

            await tempChannel.send(buildPanel(tempChannel)).catch(err => {
                logger.error('Failed to send control panel:', err);
            });

            const limitText = limit === 0 ? 'unlimited' : `${limit}`;
            const lockedText = locked ? 'locked' : 'open';
            return interaction.reply({
                content: `Created **${name}** (${lockedText}, ${limitText} slots).`,
                flags: MessageFlags.Ephemeral,
            });
        }

        if (sub === 'invite') {
            const voiceChannel = member.voice.channel;
            if (!voiceChannel) {
                return interaction.reply({ content: 'You must be in your temp VC to invite someone.', flags: MessageFlags.Ephemeral });
            }

            const tempVCs = interaction.client.tempVCs;
            if (!tempVCs?.has(voiceChannel.id)) {
                return interaction.reply({ content: 'You are not in a temp VC.', flags: MessageFlags.Ephemeral });
            }

            if (tempVCs.get(voiceChannel.id) !== member.id) {
                return interaction.reply({ content: 'Only the creator of the temp VC can invite users.', flags: MessageFlags.Ephemeral });
            }

            const target = interaction.options.getUser('user');
            if (target.id === member.id) {
                return interaction.reply({ content: 'You cannot invite yourself.', flags: MessageFlags.Ephemeral });
            }

            try {
                await (voiceChannel as any).permissionOverwrites.edit(target.id, {
                    [PermissionFlagsBits.Connect as any]: true,
                });

                const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
                await targetMember?.send(
                    `**${member.user.username}** invited you to join **${voiceChannel.name}** in **${interaction.guild.name}**.`
                ).catch(() => {});

                return interaction.reply({ content: `**${target.username}** has been invited to join **${voiceChannel.name}**.`, flags: MessageFlags.Ephemeral });
            } catch (error) {
                logger.error('Invite error:', error);
                return interaction.reply({ content: 'Failed to invite the user.', flags: MessageFlags.Ephemeral });
            }
        }
    },
};
