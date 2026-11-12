import { voiceChannelError } from '../../utils/music';

function interactionIn(channelId: string | null | undefined, member: any = { voice: { channelId } }): any {
    return { member };
}

describe('voiceChannelError', () => {
    test('returns null when the member is in the same voice channel as the player', () => {
        expect(voiceChannelError(interactionIn('vc1'), { voiceChannelId: 'vc1' })).toBeNull();
    });

    test('rejects a member who is not in a voice channel', () => {
        expect(voiceChannelError(interactionIn(null), { voiceChannelId: 'vc1' }))
            .toBe('You need to be in a voice channel to control the music.');
    });

    test('rejects a member in a different voice channel and names the bot\'s channel', () => {
        expect(voiceChannelError(interactionIn('vc2'), { voiceChannelId: 'vc1' }))
            .toBe('You need to be in the same voice channel as me (<#vc1>) to control the music.');
    });

    test('allows any voice channel when the player has no channel recorded', () => {
        expect(voiceChannelError(interactionIn('vc2'), { voiceChannelId: null })).toBeNull();
    });

    test('rejects when the interaction has no member or no voice state', () => {
        expect(voiceChannelError(interactionIn(null, null), { voiceChannelId: 'vc1' })).toMatch(/voice channel/);
        expect(voiceChannelError(interactionIn(null, {}), { voiceChannelId: 'vc1' })).toMatch(/voice channel/);
    });
});
