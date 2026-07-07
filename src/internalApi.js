const http = require('node:http');
const { endGiveaway } = require('../slashCommands/utility/giveaway');
const GiveawaySchema = require('../models/GiveawaySchema');
const log = require('../utils/log');
const logger = log.scope('internal-api');

const PORT = process.env.INTERNAL_API_PORT || 4000;
const SECRET = process.env.INTERNAL_API_SECRET;

function send(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        let bytes = 0;
        req.on('data', chunk => {
            bytes += chunk.length;
            if (bytes > MAX_BODY_BYTES) {
                req.destroy();
                return reject(new Error('Request body too large'));
            }
            body += chunk;
        });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

module.exports = function startInternalApi(client) {
    const server = http.createServer(async (req, res) => {
        if (!SECRET || req.headers['x-internal-secret'] !== SECRET) {
            return send(res, 401, { error: 'Unauthorized' });
        }

        const url = new URL(req.url, `http://localhost:${PORT}`);

        if (req.method === 'POST' && url.pathname === '/internal/giveaway/end') {
            try {
                const raw = await readBody(req);
                const { guildId, messageId } = JSON.parse(raw);
                if (!guildId || !messageId) return send(res, 400, { error: 'Missing guildId or messageId' });

                const giveaway = await GiveawaySchema.findOne({ guildId: String(guildId), messageId: String(messageId), ended: false });
                if (!giveaway) return send(res, 404, { error: 'Active giveaway not found' });

                await endGiveaway(client, giveaway);
                send(res, 200, { ok: true });
            } catch (err) {
                logger.error('/internal/giveaway/end error:', err);
                send(res, 500, { error: 'Internal error' });
            }
            return;
        }

        if (req.method === 'POST' && url.pathname === '/internal/giveaway/reroll') {
            try {
                const raw = await readBody(req);
                const { guildId, messageId } = JSON.parse(raw);
                if (!guildId || !messageId) return send(res, 400, { error: 'Missing guildId or messageId' });

                const giveaway = await GiveawaySchema.findOne({ guildId: String(guildId), messageId: String(messageId), ended: true });
                if (!giveaway) return send(res, 404, { error: 'Ended giveaway not found' });

                const guild = await client.guilds.fetch(guildId).catch(() => null);
                let eligibleEntrants = giveaway.entrants;
                if (giveaway.requireRoleId && guild) {
                    const members = await guild.members.fetch({ user: giveaway.entrants }).catch(() => new Map());
                    eligibleEntrants = giveaway.entrants.filter(id => {
                        const m = members.get(id);
                        return m && m.roles.cache.has(giveaway.requireRoleId);
                    });
                }

                const pool = eligibleEntrants.filter(id => id !== giveaway.hostId);
                const shuffled = [...pool].sort(() => Math.random() - 0.5);
                const winners = shuffled.slice(0, giveaway.winnerCount);
                giveaway.winners = winners;
                await giveaway.save();

                const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
                if (channel) {
                    const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
                    if (message) {
                        const { EmbedBuilder } = require('discord.js');
                        const current = message.embeds[0];
                        if (current) {
                            const updated = EmbedBuilder.from(current).spliceFields(
                                current.fields.findIndex(f => f.name === 'Winner(s)'),
                                1,
                                { name: 'Winner(s)', value: winners.length ? winners.map(id => `<@${id}>`).join(', ') : 'No valid entrants.' }
                            );
                            await message.edit({ embeds: [updated] }).catch(() => {});
                        }
                    }
                    const mention = winners.length
                        ? `🎉 Reroll! Congratulations ${winners.map(id => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**!`
                        : `No valid entrants for the reroll of **${giveaway.prize}**.`;
                    await channel.send({ content: mention }).catch(() => {});
                }

                send(res, 200, { ok: true });
            } catch (err) {
                logger.error('/internal/giveaway/reroll error:', err);
                send(res, 500, { error: 'Internal error' });
            }
            return;
        }

        send(res, 404, { error: 'Not found' });
    });

    server.listen(PORT, '127.0.0.1', () => logger.info(`Listening on port ${PORT}`));
};
