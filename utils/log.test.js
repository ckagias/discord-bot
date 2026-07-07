describe('log', () => {
    let consoleLogSpy, consoleErrorSpy, consoleWarnSpy;

    beforeEach(() => {
        jest.resetModules();
        delete process.env.LOG_LEVEL;
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('info/warn/error route to the matching console method with a timestamped, leveled prefix', () => {
        const log = require('./log');

        log.info('hello');
        log.warn('careful');
        log.error('boom');

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*\[INFO\]$/), 'hello');
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringMatching(/\[WARN\]$/), 'careful');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/\[ERROR\]$/), 'boom');
    });

    test('log.scope(name) includes the scope in the prefix', () => {
        const log = require('./log');
        const scoped = log.scope('automod');

        scoped.error('failed to timeout member');

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/\[ERROR\] \[automod\]$/), 'failed to timeout member');
    });

    test('debug is suppressed by default (info level)', () => {
        const log = require('./log');

        log.debug('verbose detail');

        expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    test('LOG_LEVEL=debug enables debug output', () => {
        process.env.LOG_LEVEL = 'debug';
        const log = require('./log');

        log.debug('verbose detail');

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/\[DEBUG\]$/), 'verbose detail');
    });

    test('LOG_LEVEL=error suppresses warn and info', () => {
        process.env.LOG_LEVEL = 'error';
        const log = require('./log');

        log.warn('careful');
        log.info('hello');
        log.error('boom');

        expect(consoleWarnSpy).not.toHaveBeenCalled();
        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
});
