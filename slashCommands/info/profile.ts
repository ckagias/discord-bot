import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import LevelSchema from '../../models/LevelSchema';
import WarnSchema from '../../models/WarnSchema';
import InventorySchema from '../../models/InventorySchema';
import { getWallet, formatBalance } from '../../utils/economy';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription("View a member's server profile — level, balance, warns, and more.")
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The member to look up (leave blank to check yourself)')
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const target = interaction.options.getUser('user') ?? interaction.user;
        const { guild } = interaction;

        const [fetchedUser, member] = await Promise.all([
            target.fetch(),
            guild.members.fetch(target.id).catch(() => null),
        ]);

        const [levelData, wallet, warnCount, inventory] = await Promise.all([
            LevelSchema.findOne({ userId: target.id, guildId: guild.id }),
            getWallet(target.id, guild.id),
            WarnSchema.countDocuments({ guildId: guild.id, userId: target.id }),
            InventorySchema.findOne({ userId: target.id, guildId: guild.id }),
        ]);

        const level = levelData?.level ?? 0;
        const xp = levelData?.xp ?? 0;
        const xpNeeded = 100 * Math.pow(level + 1, 2);

        const balanceValue = `${formatBalance(wallet.balance)} coins`;

        const flags = fetchedUser.flags?.toArray();
        const discordBadges = flags?.length ? flags.map(f => f.replace(/_/g, ' ')).join(', ') : null;

        const shopBadges = inventory?.items.filter(i => i.type === 'badge').map(i => i.emoji) ?? [];
        const badgeText = [discordBadges ? `\`${discordBadges}\`` : null, shopBadges.join(' ')].filter(Boolean).join(' ') || '`None`';

        const createdAt = `<t:${Math.floor(target.createdTimestamp / 1000)}:D>`;
        const joinedAt = member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : 'N/A';

        const embed = new EmbedBuilder()
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setAuthor({
                name: member && member.displayName !== target.username
                    ? `${member.displayName} (${target.username})`
                    : `${target.username}`,
                iconURL: member?.displayAvatarURL({ dynamic: true } as any) ?? target.displayAvatarURL({ dynamic: true } as any),
            })
            .setThumbnail(member?.displayAvatarURL({ dynamic: true, size: 256 } as any) ?? target.displayAvatarURL({ dynamic: true, size: 256 } as any))
            .addFields(
                { name: '⭐ Level', value: `${level} (${xp} / ${xpNeeded} XP)`, inline: true },
                { name: '💰 Balance', value: balanceValue, inline: true },
                { name: '⚠️ Warnings', value: warnCount === 0 ? '`None`' : `\`${warnCount}\``, inline: true },
                { name: '📅 Joined Server', value: joinedAt, inline: true },
                { name: '🗓️ Account Created', value: createdAt, inline: true },
                { name: '🏅 Badges', value: badgeText, inline: true },
            )
            .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    },
};
