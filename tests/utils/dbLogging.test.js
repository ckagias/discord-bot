const { EventEmitter } = require('events');
const { attachConnectionLogging } = require('../../utils/dbLogging');

describe('attachConnectionLogging', () => {
    let consoleErrorSpy, consoleWarnSpy, consoleLogSpy, connection;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        connection = new EventEmitter();
        attachConnectionLogging(connection);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('logs connection errors', () => {
        const err = new Error('bad connection');

        connection.emit('error', err);

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR] [index]'), 'MongoDB connection error:', err);
    });

    test('logs disconnects as a warning', () => {
        connection.emit('disconnected');

        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN] [index]'), 'MongoDB disconnected');
    });

    test('logs reconnects', () => {
        connection.emit('reconnected');

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] [index]'), 'MongoDB reconnected');
    });
});
