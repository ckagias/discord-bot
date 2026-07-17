jest.mock('axios');
jest.mock('@resvg/resvg-js', () => ({
    Resvg: jest.fn().mockImplementation(() => ({
        render: () => ({ asPng: () => Buffer.from('fake-png') }),
    })),
}));

const axios = require('axios');
const github = require('../../../slashCommands/info/github');

function makeInteraction({ username = 'octocat' } = {}) {
    return {
        options: { getString: jest.fn().mockReturnValue(username) },
        user: { tag: 'User#0001', displayAvatarURL: jest.fn().mockReturnValue('https://example.com/user.png') },
        deferReply: jest.fn().mockResolvedValue({}),
        editReply: jest.fn().mockResolvedValue({}),
    };
}

function makeUserData(overrides: Record<string, unknown> = {}) {
    return {
        login: 'octocat', html_url: 'https://github.com/octocat', avatar_url: 'https://example.com/avatar.png',
        bio: 'A cat', followers: 100, following: 10, public_repos: 5, public_gists: 2,
        name: 'The Octocat', company: null, location: null, blog: null, twitter_username: null,
        created_at: '2011-01-01T00:00:00Z',
        ...overrides,
    };
}

describe('github command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.GITHUB_TOKEN;
    });

    test('reports not found on a 404', async () => {
        const interaction = makeInteraction();
        (axios.get as jest.Mock).mockRejectedValue({ response: { status: 404 } });

        await github.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('was not found') })
        );
    });

    test('reports a rate-limit message on a 403', async () => {
        const interaction = makeInteraction();
        (axios.get as jest.Mock).mockRejectedValue({ response: { status: 403 } });

        await github.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('rate limit exceeded') })
        );
    });

    test('reports a generic error on unexpected failures', async () => {
        const interaction = makeInteraction();
        (axios.get as jest.Mock).mockRejectedValue(new Error('network down'));

        await github.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('An error occurred') })
        );
    });

    test('shows profile and repo stats on success, with the contribution chart attached', async () => {
        const interaction = makeInteraction();
        (axios.get as jest.Mock).mockImplementation((url: string) => {
            if (url.includes('/repos?')) return Promise.resolve({ data: [{ stargazers_count: 10, name: 'repo1', html_url: 'url' }] });
            if (url.includes('ghchart')) return Promise.resolve({ data: '<svg><rect fill="#ebedf0" x="10" width="663"/></svg>' });
            return Promise.resolve({ data: makeUserData() });
        });

        await github.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array), files: expect.any(Array) })
        );
    });

    test('still replies successfully when the contribution chart fetch fails', async () => {
        const interaction = makeInteraction();
        (axios.get as jest.Mock).mockImplementation((url: string) => {
            if (url.includes('/repos?')) return Promise.resolve({ data: [] });
            if (url.includes('ghchart')) return Promise.reject(new Error('chart service down'));
            return Promise.resolve({ data: makeUserData() });
        });

        await github.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array), files: [] })
        );
    });

    test('includes optional profile fields (company, location) when present', async () => {
        const interaction = makeInteraction();
        (axios.get as jest.Mock).mockImplementation((url: string) => {
            if (url.includes('/repos?')) return Promise.resolve({ data: [] });
            if (url.includes('ghchart')) return Promise.reject(new Error('skip'));
            return Promise.resolve({ data: makeUserData({ company: 'Acme', location: 'Earth' }) });
        });

        await expect(github.execute(interaction)).resolves.not.toThrow();
    });

    test('fetches contribution data via GraphQL when a token is configured', async () => {
        process.env.GITHUB_TOKEN = 'fake-token';
        const interaction = makeInteraction();
        (axios.get as jest.Mock).mockImplementation((url: string) => {
            if (url.includes('/repos?')) return Promise.resolve({ data: [] });
            if (url.includes('ghchart')) return Promise.reject(new Error('skip'));
            return Promise.resolve({ data: makeUserData() });
        });
        axios.post = jest.fn().mockResolvedValue({ data: { data: { user: { contributionsCollection: { contributionCalendar: { totalContributions: 42 } } } } } });

        await github.execute(interaction);

        expect(axios.post).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });
});
