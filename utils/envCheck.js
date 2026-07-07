const REQUIRED = ['Token', 'ClientID', 'MONGODB_URL'];

// Optional vars that degrade a specific feature instead of the whole bot when missing.
const OPTIONAL = {
    WEATHER_API_KEY: '/weather will fail',
    GITHUB_TOKEN: '/github will use unauthenticated, rate-limited GitHub API calls',
    INTERNAL_API_SECRET: 'the internal API will reject every request (dashboard giveaway end/reroll will silently fail)',
};

// Exits the process if a required var is missing; warns (without exiting) for optional ones.
function checkEnv(env, logger) {
    const missing = REQUIRED.filter(k => !env[k]);
    if (missing.length) {
        logger.error('Missing required env vars:', missing.join(', '));
        process.exit(1);
    }

    for (const [key, consequence] of Object.entries(OPTIONAL)) {
        if (!env[key]) logger.warn(`${key} is not set — ${consequence}.`);
    }
}

module.exports = { checkEnv, REQUIRED, OPTIONAL };
