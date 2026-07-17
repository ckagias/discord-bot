import http, { IncomingMessage, ServerResponse } from 'node:http';
import mongoose from 'mongoose';
import { Client, EmbedBuilder } from 'discord.js';
const { endGiveaway } = require('../slashCommands/utility/giveaway');
const { applyStatus } = require('../slashCommands/utility/suggest');
import { startLockdown, endLockdown } from '../utils/antiRaid';
import { getGuildConfig } from '../utils/guildConfig';
import GiveawaySchema from '../models/GiveawaySchema';
import SuggestionSchema from '../models/SuggestionSchema';
import log from '../utils/log';
const logger = log.scope('internal-api');

const PORT = process.env.INTERNAL_API_PORT || 4000;
const SECRET = process.env.INTERNAL_API_SECRET;

function send(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

function readBody(req: IncomingMessage): Promise<string> {
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

export = function startInternalApi(client: Client) {
    const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url as string, `http://localhost:${PORT}`);

        if (req.method === 'GET' && url.pathname === '/internal/health') {
            const healthy = client.isReady() && mongoose.connection.readyState === 1;
            return send(res, healthy ? 200 : 503, {
                discord: client.isReady() ? 'up' : 'down',
                mongo: mongoose.connection.readyState === 1 ? 'up' : 'down',
                ping: client.isReady() ? client.ws.ping : null,
                uptime: client.isReady() ? client.uptime : null,
            });
        }

        if (!SECRET || req.headers['x-internal-secret'] !== SECRET) {
            return send(res, 401, { error: 'Unauthorized' });
        }

        if (req.method === 'POST' && url.pathname === '/internal/giveaway/end') {
            try {
                const raw = await readBody(req);
                const { guildId, messageId }: { guildId?: string; messageId?: string } = JSON.parse(raw);
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
                const { guildId, messageId }: { guildId?: string; messageId?: string } = JSON.parse(raw);
                if (!guildId || !messageId) return send(res, 400, { error: 'Missing guildId or messageId' });

                const giveaway = await GiveawaySchema.findOne({ guildId: String(guildId), messageId: String(messageId), ended: true });
                if (!giveaway) return send(res, 404, { error: 'Ended giveaway not found' });

                const guild = await client.guilds.fetch(guildId).catch(() => null);
                let eligibleEntrants = giveaway.entrants;
                if (giveaway.requireRoleId && guild) {
                    const members = await guild.members.fetch({ user: giveaway.entrants }).catch(() => new Map());
                    eligibleEntrants = giveaway.entrants.filter(id => {
                        const m = members.get(id);
                        return m && m.roles.cache.has(giveaway.requireRoleId as string);
                    });
                }

                const pool = eligibleEntrants.filter(id => id !== giveaway.hostId);
                const shuffled = [...pool].sort(() => Math.random() - 0.5);
                const winners = shuffled.slice(0, giveaway.winnerCount);
                giveaway.winners = winners;
                await giveaway.save();

                const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
                if (channel && 'messages' in channel) {
                    const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
                    if (message) {
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
                    await (channel as any).send({ content: mention }).catch(() => {});
                }

                send(res, 200, { ok: true });
            } catch (err) {
                logger.error('/internal/giveaway/reroll error:', err);
                send(res, 500, { error: 'Internal error' });
            }
            return;
        }

        if (req.method === 'POST' && url.pathname === '/internal/suggestion/status') {
            try {
                const raw = await readBody(req);
                const { guildId, messageId, status, staffId }: { guildId?: string; messageId?: string; status?: string; staffId?: string } = JSON.parse(raw);
                if (!guildId || !messageId || !status) return send(res, 400, { error: 'Missing guildId, messageId, or status' });
                if (!['approved', 'denied', 'implemented'].includes(status)) return send(res, 400, { error: 'Invalid status' });

                const suggestion = await SuggestionSchema.findOne({ guildId: String(guildId), messageId: String(messageId), status: 'pending' });
                if (!suggestion) return send(res, 404, { error: 'Pending suggestion not found' });

                await applyStatus(client, suggestion, status, staffId ?? null);
                send(res, 200, { ok: true });
            } catch (err) {
                logger.error('/internal/suggestion/status error:', err);
                send(res, 500, { error: 'Internal error' });
            }
            return;
        }

        if (req.method === 'POST' && url.pathname === '/internal/antiraid/lock') {
            try {
                const raw = await readBody(req);
                const { guildId, username }: { guildId?: string; username?: string } = JSON.parse(raw);
                if (!guildId) return send(res, 400, { error: 'Missing guildId' });

                const guild = await client.guilds.fetch(guildId).catch(() => null);
                if (!guild) return send(res, 404, { error: 'Guild not found' });

                const guildData = await getGuildConfig(guildId);
                if (!guildData?.antiRaidQuarantineRoleId) {
                    return send(res, 400, { error: 'No quarantine role configured. Set one in Quarantine Setup and save first.' });
                }
                if (guildData.antiRaidLocked) {
                    return send(res, 409, { error: 'A lockdown is already active.' });
                }
                if (!guild.roles.cache.has(guildData.antiRaidQuarantineRoleId)) {
                    return send(res, 400, { error: 'Quarantine role no longer exists.' });
                }

                await startLockdown(guild, guildData, { auto: false, triggeredBy: username ? { username } : null });
                send(res, 200, { ok: true });
            } catch (err) {
                logger.error('/internal/antiraid/lock error:', err);
                send(res, 500, { error: 'Internal error' });
            }
            return;
        }

        if (req.method === 'POST' && url.pathname === '/internal/antiraid/unlock') {
            try {
                const raw = await readBody(req);
                const { guildId, username }: { guildId?: string; username?: string } = JSON.parse(raw);
                if (!guildId) return send(res, 400, { error: 'Missing guildId' });

                const guild = await client.guilds.fetch(guildId).catch(() => null);
                if (!guild) return send(res, 404, { error: 'Guild not found' });

                const guildData = await getGuildConfig(guildId);
                if (!guildData?.antiRaidLocked) {
                    return send(res, 409, { error: 'There is no active lockdown.' });
                }

                const { released } = await endLockdown(guild, guildData, { by: username ? { username } : null });
                send(res, 200, { ok: true, released: released?.length ?? 0 });
            } catch (err) {
                logger.error('/internal/antiraid/unlock error:', err);
                send(res, 500, { error: 'Internal error' });
            }
            return;
        }

        send(res, 404, { error: 'Not found' });
    });

    server.listen(PORT, () => logger.info(`Listening on port ${PORT}`));
};
