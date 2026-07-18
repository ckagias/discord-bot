jest.mock('../../../handlers/components/tempvcPanel', () => ({ buildPanel: jest.fn().mockReturnValue({ mock: 'panel' }) }));
jest.mock('../../../utils/guildConfig', () => ({
    getGuildConfig: jest.fn(),
    updateGuildConfig: jest.fn(),
}));
jest.mock('../../../models/TempVCSchema', () => ({ create: jest.fn() }));

const { getGuildConfig, updateGuildConfig } = require('../../../utils/guildConfig');
const TempVCSchema = require('../../../models/TempVCSchema');
const tempvc = require('../../../slashCommands/utility/tempvc');

function makeMember({ id = 'user1', voiceChannel = null, hasPermission = true }: { id?: string; voiceChannel?: any; hasPermission?: boolean } = {}) {
    return {
        id,
        permissions: { has: jest.fn().mockReturnValue(hasPermission) },
        voice: { channel: voiceChannel, setChannel: jest.fn().mockResolvedValue({}) },
        user: { username: 'User' },
    };
}

function makeInteraction({ sub, member = makeMember(), category = null, name = 'My VC', locked = null, limit = null, targetUser = null }: { sub: string; member?: any; category?: any; name?: string; locked?: boolean | null; limit?: number | null; targetUser?: any }) {
    return {
        options: {
            getSubcommand: jest.fn().mockReturnValue(sub),
            getChannel: jest.fn().mockReturnValue(category),
            getString: jest.fn().mockReturnValue(name),
            getBoolean: jest.fn().mockReturnValue(locked),
            getInteger: jest.fn().mockReturnValue(limit),
            getUser: jest.fn().mockReturnValue(targetUser),
        },
        member,
        guild: {
            id: 'g1',
            name: 'Test Guild',
            roles: { everyone: 'everyone-role' },
            channels: { create: jest.fn().mockResolvedValue({ id: 'vc1', send: jest.fn().mockResolvedValue({}) }) },
            members: { fetch: jest.fn().mockResolvedValue({ send: jest.fn().mockResolvedValue({}) }) },
        },
        client: { user: { id: 'bot1' }, tempVCs: undefined },
        reply: jest.fn().mockResolvedValue({}),
    };
}

describe('tempvc command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        TempVCSchema.create.mockResolvedValue({});
    });

    describe('setup', () => {
        test('rejects without Manage Server permission', async () => {
            const interaction = makeInteraction({ sub: 'setup', member: makeMember({ hasPermission: false }) });

            await tempvc.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Manage Server') })
            );
            expect(updateGuildConfig).not.toHaveBeenCalled();
        });

        test('saves the category when provided', async () => {
            const interaction = makeInteraction({ sub: 'setup', category: { id: 'cat1', name: 'Voice Channels' } });

            await tempvc.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', { tempVcCategoryId: 'cat1' });
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Voice Channels') })
            );
        });

        test('clears the category when none is provided', async () => {
            const interaction = makeInteraction({ sub: 'setup', category: null });

            await tempvc.execute(interaction);

            expect(updateGuildConfig).toHaveBeenCalledWith('g1', { tempVcCategoryId: null });
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('category cleared') })
            );
        });
    });

    describe('create', () => {
        test('rejects when the member is not in a voice channel', async () => {
            const interaction = makeInteraction({ sub: 'create', member: makeMember({ voiceChannel: null }) });

            await tempvc.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('must be in a voice channel') })
            );
        });

        test('creates the channel, moves the member, and registers ownership', async () => {
            const member = makeMember({ voiceChannel: { parentId: 'cat1' } });
            const interaction = makeInteraction({ sub: 'create', member, name: 'My VC', locked: true, limit: 5 });
            getGuildConfig.mockResolvedValue({});

            await tempvc.execute(interaction);

            expect(interaction.guild.channels.create).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'My VC', userLimit: 5 })
            );
            expect(interaction.client.tempVCs.get('vc1')).toBe('user1');
            expect(TempVCSchema.create).toHaveBeenCalledWith({ guildId: 'g1', channelId: 'vc1', ownerId: 'user1' });
            expect(member.voice.setChannel).toHaveBeenCalled();
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('locked, 5 slots') })
            );
        });

        test('still moves the member and replies if persisting the temp VC fails', async () => {
            const member = makeMember({ voiceChannel: { parentId: 'cat1' } });
            const interaction = makeInteraction({ sub: 'create', member });
            getGuildConfig.mockResolvedValue({});
            TempVCSchema.create.mockRejectedValue(new Error('db down'));

            await expect(tempvc.execute(interaction)).resolves.not.toThrow();
            expect(member.voice.setChannel).toHaveBeenCalled();
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Created') })
            );
        });

        test('reports failure when channel creation fails', async () => {
            const member = makeMember({ voiceChannel: { parentId: 'cat1' } });
            const interaction = makeInteraction({ sub: 'create', member });
            getGuildConfig.mockResolvedValue({});
            (interaction.guild.channels.create as jest.Mock).mockRejectedValue(new Error('missing permission'));

            await expect(tempvc.execute(interaction)).resolves.not.toThrow();
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Failed to create the voice channel') })
            );
        });
    });

    describe('invite', () => {
        test('rejects when the member is not in a voice channel', async () => {
            const interaction = makeInteraction({ sub: 'invite', member: makeMember({ voiceChannel: null }) });

            await tempvc.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('must be in your temp VC') })
            );
        });

        test('rejects when the voice channel is not a registered temp VC', async () => {
            const member = makeMember({ voiceChannel: { id: 'vc1' } });
            const interaction: any = makeInteraction({ sub: 'invite', member });
            interaction.client.tempVCs = new Map();

            await tempvc.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'You are not in a temp VC.' })
            );
        });

        test('rejects when the inviter is not the temp VC creator', async () => {
            const member = makeMember({ id: 'user1', voiceChannel: { id: 'vc1' } });
            const interaction: any = makeInteraction({ sub: 'invite', member });
            interaction.client.tempVCs = new Map([['vc1', 'someoneElse']]);

            await tempvc.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Only the creator') })
            );
        });

        test('rejects inviting yourself', async () => {
            const member = makeMember({ id: 'user1', voiceChannel: { id: 'vc1' } });
            const interaction: any = makeInteraction({ sub: 'invite', member, targetUser: { id: 'user1' } });
            interaction.client.tempVCs = new Map([['vc1', 'user1']]);

            await tempvc.execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'You cannot invite yourself.' })
            );
        });

        test('grants connect permission and DMs the invited user', async () => {
            const edit = jest.fn().mockResolvedValue({});
            const member = makeMember({ id: 'user1', voiceChannel: { id: 'vc1', name: 'My VC', permissionOverwrites: { edit } } });
            const interaction: any = makeInteraction({ sub: 'invite', member, targetUser: { id: 'target1', username: 'Target' } });
            interaction.client.tempVCs = new Map([['vc1', 'user1']]);

            await tempvc.execute(interaction);

            expect(edit).toHaveBeenCalled();
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('has been invited') })
            );
        });

        test('reports failure when permission edit fails', async () => {
            const edit = jest.fn().mockRejectedValue(new Error('permission denied'));
            const member = makeMember({ id: 'user1', voiceChannel: { id: 'vc1', name: 'My VC', permissionOverwrites: { edit } } });
            const interaction: any = makeInteraction({ sub: 'invite', member, targetUser: { id: 'target1', username: 'Target' } });
            interaction.client.tempVCs = new Map([['vc1', 'user1']]);

            await expect(tempvc.execute(interaction)).resolves.not.toThrow();
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'Failed to invite the user.' })
            );
        });
    });
});
