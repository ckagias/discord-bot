const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, MessageFlags } = require('discord.js');

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
                        .setRequired(true))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const member = interaction.member;

        if (sub === 'create') {
            const voiceChannel = member.voice.channel;
            if (!voiceChannel) {
                return interaction.reply({ content: 'You must be in a voice channel to create a temp VC.', flags: MessageFlags.Ephemeral });
            }

            const name = interaction.options.getString('name');
            const locked = interaction.options.getBoolean('locked') ?? false;
            const limit = interaction.options.getInteger('limit') ?? 0;

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
                    parent: voiceChannel.parentId,
                    userLimit: limit,
                    permissionOverwrites,
                });
            } catch (error) {
                console.error('[tempvc] Channel creation error:', error);
                return interaction.reply({ content: 'Failed to create the voice channel. Make sure I have the **Manage Channels** permission.', flags: MessageFlags.Ephemeral });
            }

            if (!interaction.client.tempVCs) interaction.client.tempVCs = new Map();
            interaction.client.tempVCs.set(tempChannel.id, member.id);

            await member.voice.setChannel(tempChannel).catch(err => {
                console.error('[tempvc] Failed to move member:', err);
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
                await voiceChannel.permissionOverwrites.edit(target.id, {
                    [PermissionFlagsBits.Connect]: true,
                });

                const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
                await targetMember?.send(
                    `**${member.user.username}** invited you to join **${voiceChannel.name}** in **${interaction.guild.name}**.`
                ).catch(() => {});

                return interaction.reply({ content: `**${target.username}** has been invited to join **${voiceChannel.name}**.`, flags: MessageFlags.Ephemeral });
            } catch (error) {
                console.error('[tempvc] Invite error:', error);
                return interaction.reply({ content: 'Failed to invite the user.', flags: MessageFlags.Ephemeral });
            }
        }
    },
};
