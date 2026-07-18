import { EmbedBuilder, VoiceState, Client } from 'discord.js';
const { getLogChannel } = require('../utils/logger');
const TempVCSchema = require('../models/TempVCSchema');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState: VoiceState, newState: VoiceState, client: Client) {
        const member = newState.member ?? oldState.member;
        if (!member || member.user.bot) return;

        if (oldState.channelId && client.tempVCs?.has(oldState.channelId)) {
            const channel = oldState.channel;
            if (channel && channel.members.size === 0) {
                client.tempVCs.delete(oldState.channelId);
                await TempVCSchema.deleteOne({ channelId: oldState.channelId }).catch(() => {});
                await channel.delete().catch(() => {});
            }
        }


        const logChannel = await getLogChannel(member.guild).catch(() => null);
        if (!logChannel) return;

        const joined = !oldState.channelId && newState.channelId;
        const left = oldState.channelId && !newState.channelId;
        const moved = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;
        const serverDeafened = !oldState.serverDeaf && newState.serverDeaf;
        const serverUndeafened = oldState.serverDeaf && !newState.serverDeaf;
        const serverMuted = !oldState.serverMute && newState.serverMute;
        const serverUnmuted = oldState.serverMute && !newState.serverMute;

        if (!joined && !left && !moved && !serverDeafened && !serverUndeafened && !serverMuted && !serverUnmuted) return;

        let description;

        if (joined) {
            description = `**${member.user.username}** joined voice channel <#${newState.channelId}>`;
        } else if (left) {
            description = `**${member.user.username}** left voice channel <#${oldState.channelId}>`;
        } else if (moved) {
            description = `**${member.user.username}** moved from <#${oldState.channelId}> to <#${newState.channelId}>`;
        } else if (serverDeafened) {
            description = `**${member.user.username}** was server deafened in <#${newState.channelId}>`;
        } else if (serverUndeafened) {
            description = `**${member.user.username}** was server undeafened in <#${newState.channelId}>`;
        } else if (serverMuted) {
            description = `**${member.user.username}** was server muted in <#${newState.channelId}>`;
        } else {
            description = `**${member.user.username}** was server unmuted in <#${newState.channelId}>`;
        }

        const channelId = newState.channelId ?? oldState.channelId;

        const embed = new EmbedBuilder()
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setAuthor({
                name: member.user.username,
                iconURL: member.user.displayAvatarURL({ size: 64 }),
            })
            .setDescription(description)
            .addFields(
                { name: 'User ID', value: `\`${member.user.id}\``, inline: true },
                { name: 'Channel ID', value: `\`${channelId}\``, inline: true }
            )
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    },
};