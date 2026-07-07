const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const mongoose = require('mongoose');
require('dotenv').config({ debug: false });
// Use Cloudflare DNS — improves reliability for MongoDB Atlas connections
const dns = require('node:dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);
const log = require('../utils/log');
const logger = log.scope('index');
const { attachConnectionLogging } = require('../utils/dbLogging');

const required = ['Token', 'ClientID', 'MONGODB_URL'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
    logger.error('Missing required env vars:', missing.join(', '));
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

attachConnectionLogging(mongoose.connection);

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        logger.info('Connected to MongoDB');
    } catch (err) {
        logger.error('MongoDB connection failed:', err);
        process.exit(1);
    }

    require('../handlers/eventHandler')(client);
    require('../handlers/slashCommandHandler')(client);
    require('../handlers/componentHandler')(client);
    require('../handlers/lavalinkHandler')(client);

    // Forward raw gateway packets to Lavalink for voice state tracking
    client.on(Events.Raw, (d) => client.lavalink.sendRawData(d));

    await client.login(process.env.Token);

    require('./internalApi')(client);
})();

process.on('unhandledRejection', (reason) => {
    logger.error('[Unhandled Rejection]', reason);
});

process.on('uncaughtException', (err) => {
    logger.error('[Uncaught Exception]', err);
});

async function shutdown(signal) {
    logger.info(`[${signal}] Shutting down gracefully...`);
    client.destroy();
    await mongoose.connection.close();
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));