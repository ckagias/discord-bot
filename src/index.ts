import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ debug: false });
// Use Cloudflare DNS — improves reliability for MongoDB Atlas connections
import dns from 'node:dns';
dns.setServers(['1.1.1.1', '1.0.0.1']);
import log from '../utils/log';
const logger = log.scope('index');
import { attachConnectionLogging } from '../utils/dbLogging';
import { checkEnv } from '../utils/envCheck';

checkEnv(process.env, logger);

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
        await mongoose.connect(process.env.MONGODB_URL as string);
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
    client.on(Events.Raw, (d: unknown) => client.lavalink.sendRawData(d as any));

    await client.login(process.env.Token);

    require('./internalApi')(client);
})();

async function shutdown(signal: string, exitCode = 0) {
    logger.info(`[${signal}] Shutting down gracefully...`);
    try {
        client.destroy();
        await mongoose.connection.close();
    } catch (err) {
        logger.error('Error during shutdown:', err);
    }
    process.exit(exitCode);
}

// Process state is undefined after either of these fires, so crash and let Docker restart clean.
process.on('unhandledRejection', (reason) => {
    logger.error('[Unhandled Rejection]', reason);
    shutdown('unhandledRejection', 1);
});

process.on('uncaughtException', (err) => {
    logger.error('[Uncaught Exception]', err);
    shutdown('uncaughtException', 1);
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
