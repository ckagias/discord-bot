import { EmbedBuilder, MessageReaction } from 'discord.js';
import { getGuildConfig } from './guildConfig';
import StarboardSchema from '../models/StarboardSchema';
import log = require('./log');
const logger = log.scope('starboard');

/**
 * Handle a star reaction being added or removed on a message.
 * Called by both messageReactionAdd and messageReactionRemove events.
 */
async function handleStarReaction(reaction: MessageReaction): Promise<void> {
    // Resolve partials — we need message content, author, and attachments
    if (reaction.partial) {
        try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
        try { await reaction.message.fetch(); } catch { return; }
    }

    const { message, emoji } = reaction;
    if (!message.guild) return;

    // Load and validate guild config
    const config = await getGuildConfig(message.guild.id).catch(() => null);
    if (!config?.starboardEnabled || !config.starboardChannelId) return;

    // Only process the configured emoji (unicode name match for ⭐, id match for custom)
    const emojiKey = emoji.id ?? emoji.name;
    const configKey = config.starboardEmoji;
    if (emojiKey !== configKey) return;

    // Ignore bot-authored messages
    if (message.author?.bot) return;

    // Ignore messages already in the starboard channel
    if (message.channel.id === config.starboardChannelId) return;

    // Ignore NSFW channels if configured to do so
    if (config.starboardIgnoreNsfw && (message.channel as any).nsfw) return;

    // Get the current live star count for the configured emoji
    const count = message.reactions.cache.get(emojiKey as string)?.count ?? 0;

    const guildId = message.guild.id;
    const channelId = message.channel.id;
    const messageId = message.id;

    const existing = await StarboardSchema.findOne({ guildId, messageId }).catch(() => null);

    const starboardChannel = message.guild.channels.cache.get(config.starboardChannelId);
    if (!starboardChannel?.isTextBased()) return;

    if (!existing) {
        // Not yet posted — post if we've hit the threshold
        if (count < config.starboardThreshold) return;

        const embed = buildEmbed(message, guildId, channelId, messageId);
        const posted = await starboardChannel.send({
            content: `${config.starboardEmoji} **${count}** | <#${channelId}>`,
            embeds: [embed],
        }).catch(err => { logger.error('Failed to post message:', err); return null; });

        if (!posted) return;

        await StarboardSchema.create({
            guildId,
            channelId,
            messageId,
            starboardMessageId: posted.id,
            starCount: count,
        }).catch(err => logger.error('Failed to save doc:', err));

    } else if (count >= config.starboardThreshold) {
        // Already posted — update the star count
        const postedMsg = await starboardChannel.messages.fetch(existing.starboardMessageId).catch(() => null);
        if (postedMsg) {
            const embed = buildEmbed(message, guildId, channelId, messageId);
            await postedMsg.edit({
                content: `${config.starboardEmoji} **${count}** | <#${channelId}>`,
                embeds: [embed],
            }).catch(err => logger.error('Failed to edit message:', err));
        }
        existing.starCount = count;
        await existing.save().catch(err => logger.error('Failed to update doc:', err));

    } else {
        // Already posted but stars dropped below threshold — remove it
        const postedMsg = await starboardChannel.messages.fetch(existing.starboardMessageId).catch(() => null);
        if (postedMsg) {
            await postedMsg.delete().catch(() => null);
        }
        await existing.deleteOne().catch(err => logger.error('Failed to delete doc:', err));
    }
}

/**
 * Build the starboard embed for a message.
 */
function buildEmbed(message: MessageReaction['message'], guildId: string, channelId: string, messageId: string): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(Math.floor(Math.random() * 0xFFFFFF))
        .setAuthor({
            name: message.author!.tag,
            iconURL: message.author!.displayAvatarURL(),
        })
        .setDescription(message.content || null)
        .addFields({
            name: '​',
            value: `[**Click to jump to message!**](https://discord.com/channels/${guildId}/${channelId}/${messageId})`,
        })
        .setTimestamp(message.createdAt);

    const image = message.attachments.find(a => a.contentType?.startsWith('image/'));
    if (image) embed.setImage(image.url);

    return embed;
}

export { handleStarReaction };
