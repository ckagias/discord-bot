type Level = 'error' | 'warn' | 'info' | 'debug';

const LEVELS: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL as Level] ?? LEVELS.info;

function write(level: Level, scope: string | null, args: unknown[]): void {
    if (LEVELS[level] > currentLevel) return;
    const prefix = `${new Date().toISOString()} [${level.toUpperCase()}]${scope ? ` [${scope}]` : ''}`;
    const method = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    method(prefix, ...args);
}

function scoped(scope: string | null) {
    return {
        error: (...args: unknown[]) => write('error', scope, args),
        warn: (...args: unknown[]) => write('warn', scope, args),
        info: (...args: unknown[]) => write('info', scope, args),
        debug: (...args: unknown[]) => write('debug', scope, args),
    };
}

export = Object.assign(scoped(null), { scope: scoped });
