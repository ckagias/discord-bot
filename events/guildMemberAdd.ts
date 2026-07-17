import { EmbedBuilder, GuildMember } from 'discord.js';
const { getLogChannel } = require('../utils/logger');
const { getWelcomeConfig, formatMessage } = require('../utils/welcome');
const { getGuildConfig } = require('../utils/guildConfig');
const { handleJoin } = require('../utils/antiRaid');
const log = require('../utils/log');
const logger = log.scope('autorole');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member: GuildMember) {
        const [logChannel, welcomeConfig, guildConfig] = await Promise.all([
            getLogChannel(member.guild).catch(() => null),
            getWelcomeConfig(member.guild).catch(() => null),
            getGuildConfig(member.guild.id).catch(() => null),
        ]);

        // Autorole and welcome are skipped for quarantined members; the join log still runs.
        const quarantined = handleJoin(member, guildConfig);

        if (!quarantined && guildConfig?.autoroleId) {
            const role = member.guild.roles.cache.get(guildConfig.autoroleId);
            if (role) {
                await member.roles.add(role).catch(err =>
                    logger.error(`Failed to assign role ${role.id} to ${member.id}:`, err)
                );
            }
        }

        if (!quarantined && welcomeConfig) {
            await welcomeConfig.channel.send({ content: formatMessage(welcomeConfig.message, member) }).catch(() => {});
        }

        if (!logChannel) return;

        const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000);

        const embed = new EmbedBuilder()
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setAuthor({
                name: member.user.username,
                iconURL: member.user.displayAvatarURL({ size: 64 }),
            })
            .setDescription(`**${member.user.username}** joined the server`)
            .addFields(
                { name: 'User ID', value: `\`${member.user.id}\``, inline: true },
                { name: 'Account Age', value: `${accountAge} day${accountAge !== 1 ? 's' : ''}`, inline: true },
                { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true },
                { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: false }
            )
            .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    },
};