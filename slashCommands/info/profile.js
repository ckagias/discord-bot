const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const LevelSchema = require('../../models/LevelSchema');
const WarnSchema = require('../../models/WarnSchema');
const { getWallet, formatBalance } = require('../../utils/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription("View a member's server profile — level, balance, warns, and more.")
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The member to look up (leave blank to check yourself)')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();

        const target = interaction.options.getUser('user') ?? interaction.user;
        const { guild } = interaction;

        const [fetchedUser, member] = await Promise.all([
            target.fetch(),
            guild.members.fetch(target.id).catch(() => null),
        ]);

        const [levelData, wallet, warnCount] = await Promise.all([
            LevelSchema.findOne({ userId: target.id, guildId: guild.id }),
            getWallet(target.id, guild.id),
            WarnSchema.countDocuments({ guildId: guild.id, userId: target.id }),
        ]);

        // Level / XP
        const level = levelData?.level ?? 0;
        const xp = levelData?.xp ?? 0;
        const xpNeeded = 100 * Math.pow(level + 1, 2);

        // Economy
        const balanceValue = `${formatBalance(wallet.balance)} coins`;

        // Badges
        const flags = fetchedUser.flags?.toArray();
        const badges = flags?.length ? flags.map(f => f.replace(/_/g, ' ')).join(', ') : 'None';

        // Dates
        const createdAt = `<t:${Math.floor(target.createdTimestamp / 1000)}:D>`;
        const joinedAt = member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : 'N/A';

        const embed = new EmbedBuilder()
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setAuthor({
                name: member && member.displayName !== target.username
                    ? `${member.displayName} (${target.username})`
                    : `${target.username}`,
                iconURL: member?.displayAvatarURL({ dynamic: true }) ?? target.displayAvatarURL({ dynamic: true }),
            })
            .setThumbnail(member?.displayAvatarURL({ dynamic: true, size: 256 }) ?? target.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '⭐ Level', value: `${level} (${xp} / ${xpNeeded} XP)`, inline: true },
                { name: '💰 Balance', value: balanceValue, inline: true },
                { name: '⚠️ Warnings', value: warnCount === 0 ? '`None`' : `\`${warnCount}\``, inline: true },
                { name: '📅 Joined Server', value: joinedAt, inline: true },
                { name: '🗓️ Account Created', value: createdAt, inline: true },
                { name: '🏅 Badges', value: `\`${badges}\``, inline: true },
            )
            .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    },
};
