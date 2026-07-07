const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function write(level, scope, args) {
    if (LEVELS[level] > currentLevel) return;
    const prefix = `${new Date().toISOString()} [${level.toUpperCase()}]${scope ? ` [${scope}]` : ''}`;
    const method = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    method(prefix, ...args);
}

function scoped(scope) {
    return {
        error: (...args) => write('error', scope, args),
        warn: (...args) => write('warn', scope, args),
        info: (...args) => write('info', scope, args),
        debug: (...args) => write('debug', scope, args),
    };
}

module.exports = Object.assign(scoped(null), { scope: scoped });
