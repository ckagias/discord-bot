const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription("Shows a user's avatar.")
        .addSubcommand(sub =>
            sub.setName('global')
                .setDescription("Shows the user's global avatar")
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to show the avatar for')
                        .setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('server')
                .setDescription("Shows the user's server avatar")
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to show the avatar for')
                        .setRequired(true))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'global') {
            const user = interaction.options.getUser('user') || interaction.user;

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setTitle('Global Avatar')
                .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ dynamic: true }) })
                .setDescription(`[png](${user.displayAvatarURL({ size: 2048, extension: 'png' })}) | [jpg](${user.displayAvatarURL({ size: 2048, extension: 'jpg' })}) | [webp](${user.displayAvatarURL({ size: 2048, extension: 'webp' })})`)
                .setImage(user.displayAvatarURL({ dynamic: true, size: 4096 }))
                .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
        }

        if (sub === 'server') {
            const user = interaction.options.getUser('user');
            const member = interaction.guild.members.cache.get(user.id);

            if (!member) {
                return interaction.reply({ content: 'That user is not in this server.', flags: MessageFlags.Ephemeral });
            }

            const serverAvatar = member.avatarURL({ dynamic: true, size: 4096 });
            if (!serverAvatar) {
                return interaction.reply({ content: 'That user has no server-specific avatar.', flags: MessageFlags.Ephemeral });
            }

            const embed = new EmbedBuilder()
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setTitle('Server Avatar')
                .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ dynamic: true }) })
                .setDescription(`[png](${member.avatarURL({ size: 2048, extension: 'png' })}) | [jpg](${member.avatarURL({ size: 2048, extension: 'jpg' })}) | [webp](${member.avatarURL({ size: 2048, extension: 'webp' })})`)
                .setImage(serverAvatar)
                .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
        }
    },
};
