const { Events } = require('discord.js');
const ReactionRoleSchema = require('../models/ReactionRoleSchema');
const { handleStarReaction } = require('../utils/starboard');
const log = require('../utils/log');
const reactionRoleLogger = log.scope('reactionRole');
const starboardLogger = log.scope('starboard');

module.exports = {
    name: Events.MessageReactionAdd,

    async execute(reaction, user) {
        if (user.bot) return;

        if (reaction.partial) {
            try { await reaction.fetch(); } catch { return; }
        }

        const { message, emoji } = reaction;
        if (!message.guild) return;

        const emojiKey = emoji.id ?? emoji.name;

        const mapping = await ReactionRoleSchema.findOne({
            guildId: message.guild.id,
            messageId: message.id,
            emoji: emojiKey,
        }).catch(() => null);

        if (mapping) {
            const member = message.guild.members.cache.get(user.id)
                ?? await message.guild.members.fetch(user.id).catch(() => null);
            if (member) {
                const role = message.guild.roles.cache.get(mapping.roleId);
                if (role) {
                    await member.roles.add(role).catch(err =>
                        reactionRoleLogger.error(`Failed to add role ${role.id} to ${user.id}:`, err)
                    );
                }
            }
        }

        await handleStarReaction(reaction).catch(err =>
            starboardLogger.error('Error handling reaction add:', err)
        );
    },
};