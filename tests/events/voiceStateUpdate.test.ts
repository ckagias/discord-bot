jest.mock('../../utils/logger', () => ({ getLogChannel: jest.fn() }));
jest.mock('../../models/TempVCSchema', () => ({ deleteOne: jest.fn() }));

const { getLogChannel } = require('../../utils/logger');
const TempVCSchema = require('../../models/TempVCSchema');
const voiceStateUpdate = require('../../events/voiceStateUpdate');

function makeState({ channelId = null, channel = null, serverDeaf = false, serverMute = false, member = null } = {}) {
    return { channelId, channel, serverDeaf, serverMute, member };
}

function makeMember() {
    return { user: { id: 'user1', bot: false, username: 'User', displayAvatarURL: jest.fn().mockReturnValue('https://example.com/a.png') }, guild: { id: 'g1' } };
}

describe('voiceStateUpdate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        getLogChannel.mockResolvedValue(null);
        TempVCSchema.deleteOne.mockResolvedValue({});
    });

    test('ignores updates with no resolvable member', async () => {
        const oldState = makeState();
        const newState = makeState();
        const client = {};

        await expect(voiceStateUpdate.execute(oldState, newState, client)).resolves.not.toThrow();
    });

    test('ignores updates for bot members', async () => {
        const member = { user: { id: 'bot1', bot: true } };
        const oldState = makeState({ member });
        const newState = makeState({ member });
        const client = {};

        await voiceStateUpdate.execute(oldState, newState, client);

        expect(getLogChannel).not.toHaveBeenCalled();
    });

    test('deletes an empty temp VC when the last member leaves', async () => {
        const member = makeMember();
        const deleteChannel = jest.fn().mockResolvedValue({});
        const channel = { members: { size: 0 }, delete: deleteChannel };
        const oldState = makeState({ channelId: 'vc1', channel, member });
        const newState = makeState({ member });
        const client = { tempVCs: new Map([['vc1', 'user1']]) };

        await voiceStateUpdate.execute(oldState, newState, client);

        expect(deleteChannel).toHaveBeenCalled();
        expect(client.tempVCs.has('vc1')).toBe(false);
        expect(TempVCSchema.deleteOne).toHaveBeenCalledWith({ channelId: 'vc1' });
    });

    test('does not delete a temp VC that still has members', async () => {
        const member = makeMember();
        const deleteChannel = jest.fn();
        const channel = { members: { size: 1 }, delete: deleteChannel };
        const oldState = makeState({ channelId: 'vc1', channel, member });
        const newState = makeState({ member });
        const client = { tempVCs: new Map([['vc1', 'user1']]) };

        await voiceStateUpdate.execute(oldState, newState, client);

        expect(deleteChannel).not.toHaveBeenCalled();
    });

    test('does nothing further when no log channel is configured', async () => {
        const member = makeMember();
        const oldState = makeState({ member });
        const newState = makeState({ channelId: 'vc1', member });
        const client = {};

        await expect(voiceStateUpdate.execute(oldState, newState, client)).resolves.not.toThrow();
    });

    test('does not log when nothing relevant changed', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const member = makeMember();
        const oldState = makeState({ channelId: 'vc1', member });
        const newState = makeState({ channelId: 'vc1', member });
        const client = {};

        await voiceStateUpdate.execute(oldState, newState, client);

        expect(logChannel.send).not.toHaveBeenCalled();
    });

    test('logs a channel join', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const member = makeMember();
        const oldState = makeState({ member });
        const newState = makeState({ channelId: 'vc1', member });
        const client = {};

        await voiceStateUpdate.execute(oldState, newState, client);

        expect(logChannel.send).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('logs a channel leave', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const member = makeMember();
        const oldState = makeState({ channelId: 'vc1', member });
        const newState = makeState({ member });
        const client = {};

        await voiceStateUpdate.execute(oldState, newState, client);

        expect(logChannel.send).toHaveBeenCalled();
    });

    test('logs a channel move', async () => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const member = makeMember();
        const oldState = makeState({ channelId: 'vc1', member });
        const newState = makeState({ channelId: 'vc2', member });
        const client = {};

        await voiceStateUpdate.execute(oldState, newState, client);

        expect(logChannel.send).toHaveBeenCalled();
    });

    test.each([
        ['server deafened', { serverDeaf: false }, { serverDeaf: true }],
        ['server undeafened', { serverDeaf: true }, { serverDeaf: false }],
        ['server muted', { serverMute: false }, { serverMute: true }],
        ['server unmuted', { serverMute: true }, { serverMute: false }],
    ])('logs %s', async (_label, oldFlags, newFlags) => {
        const logChannel = { send: jest.fn().mockResolvedValue({}) };
        getLogChannel.mockResolvedValue(logChannel);
        const member = makeMember();
        const oldState = makeState({ channelId: 'vc1', member, ...oldFlags });
        const newState = makeState({ channelId: 'vc1', member, ...newFlags });
        const client = {};

        await voiceStateUpdate.execute(oldState, newState, client);

        expect(logChannel.send).toHaveBeenCalled();
    });
});
