const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const LevelSchema = require('../../models/LevelSchema');
const { getGuildConfig } = require('../../utils/guildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription("Check or set a member's level.")
        .addSubcommand(sub =>
            sub.setName('check')
                .setDescription("Check your (or another user's) current level and XP progress.")
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to look up (leave blank to check yourself)')
                        .setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription("Set a member's level and optionally their XP within that level.")
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The member whose level to set')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('The level to set')
                        .setRequired(true)
                        .setMinValue(0))
                .addIntegerOption(option =>
                    option.setName('xp')
                        .setDescription('XP within that level (defaults to 0; cannot exceed the XP needed to reach the next level)')
                        .setRequired(false)
                        .setMinValue(0))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'check') {
            await interaction.deferReply();

            const target = interaction.options.getUser('user') ?? interaction.user;
            const { guild } = interaction;

            const guildData = await getGuildConfig(guild.id);
            if (!guildData?.levelingEnabled) {
                return interaction.editReply({ content: 'Leveling is not enabled on this server.' });
            }

            const userData = await LevelSchema.findOne({ userId: target.id, guildId: guild.id });

            if (!userData || userData.xp === 0 && userData.level === 0) {
                return interaction.editReply({
                    content: `${target} hasn't earned any XP in **${guild.name}** yet!`,
                });
            }

            const xpNeeded = 100 * Math.pow(userData.level + 1, 2);
            const progress = Math.min(userData.xp / xpNeeded, 1);
            const filledBars = Math.round(progress * 20);
            const progressBar = '█'.repeat(filledBars) + '░'.repeat(20 - filledBars);

            const embed = new EmbedBuilder()
                .setTitle(`${target.username}'s Level`)
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setColor(0x5865F2)
                .addFields(
                    { name: '🏆 Level', value: `${userData.level}`, inline: true },
                    { name: '✨ XP', value: `${userData.xp} / ${xpNeeded}`, inline: true },
                    { name: '📊 Progress', value: `\`${progressBar}\` ${Math.round(progress * 100)}%` }
                )
                .setFooter({ text: guild.name, iconURL: guild.iconURL() })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (sub === 'set') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: 'You need the Manage Server permission to use this.', flags: MessageFlags.Ephemeral });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const target = interaction.options.getUser('user');
            const level = interaction.options.getInteger('level');
            const xpInput = interaction.options.getInteger('xp') ?? 0;
            const { guild } = interaction;

            // XP must be strictly less than the threshold that would trigger a level-up.
            const xpNeeded = 100 * Math.pow(level + 1, 2);
            if (xpInput >= xpNeeded) {
                return interaction.editReply({
                    content: `XP for level **${level}** must be less than **${xpNeeded}** (the amount needed to reach level ${level + 1}). To set that level, use \`/level set\` with level \`${level + 1}\`.`,
                });
            }

            const [, guildData] = await Promise.all([
                LevelSchema.findOneAndUpdate(
                    { userId: target.id, guildId: guild.id },
                    { $set: { level, xp: xpInput } },
                    { upsert: true }
                ),
                getGuildConfig(guild.id),
            ]);

            const member = await guild.members.fetch(target.id).catch(() => null);
            if (member && guildData?.levelRoles?.length) {
                const mappings = guildData.levelRoles.filter(lr => lr.level <= level);
                for (const lr of mappings) {
                    const role = guild.roles.cache.get(lr.roleId);
                    if (role && !member.roles.cache.has(role.id)) {
                        await member.roles.add(role, `Level set to ${level} by ${interaction.user.tag}`).catch(() => {});
                    }
                }
            }

            const xpNote = xpInput > 0 ? ` with **${xpInput} XP**` : ' (XP reset to 0)';
            return interaction.editReply({ content: `Set **${target.username}**'s level to **${level}**${xpNote}.` });
        }
    },
};
