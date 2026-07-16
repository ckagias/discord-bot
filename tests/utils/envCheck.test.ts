import { checkEnv } from '../../utils/envCheck';

function makeLogger() {
    return { error: jest.fn(), warn: jest.fn(), info: jest.fn() };
}

function fullEnv(overrides: Record<string, string | undefined> = {}) {
    return {
        Token: 't',
        ClientID: 'c',
        MONGODB_URL: 'm',
        WEATHER_API_KEY: 'w',
        GITHUB_TOKEN: 'g',
        INTERNAL_API_SECRET: 's',
        ...overrides,
    };
}

describe('checkEnv', () => {
    let exitSpy: jest.SpyInstance;

    beforeEach(() => {
        exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    });

    afterEach(() => {
        exitSpy.mockRestore();
    });

    test('does nothing when every var is set', () => {
        const logger = makeLogger();

        checkEnv(fullEnv(), logger);

        expect(logger.error).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
        expect(exitSpy).not.toHaveBeenCalled();
    });

    test('exits the process when a required var is missing', () => {
        const logger = makeLogger();

        checkEnv(fullEnv({ Token: undefined }), logger);

        expect(logger.error).toHaveBeenCalledWith('Missing required env vars:', 'Token');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test('lists every missing required var at once', () => {
        const logger = makeLogger();

        checkEnv(fullEnv({ Token: undefined, ClientID: undefined }), logger);

        expect(logger.error).toHaveBeenCalledWith('Missing required env vars:', 'Token, ClientID');
    });

    test('warns without exiting when an optional var is missing', () => {
        const logger = makeLogger();

        checkEnv(fullEnv({ WEATHER_API_KEY: undefined }), logger);

        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('WEATHER_API_KEY'));
        expect(exitSpy).not.toHaveBeenCalled();
    });

    test('warns for each missing optional var independently', () => {
        const logger = makeLogger();

        checkEnv(fullEnv({ GITHUB_TOKEN: undefined, INTERNAL_API_SECRET: undefined }), logger);

        expect(logger.warn).toHaveBeenCalledTimes(2);
    });
});
