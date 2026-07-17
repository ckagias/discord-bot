jest.mock('axios');

const axios = require('axios');
const weather = require('../../../slashCommands/info/weather');

function makeCollector() {
    const handlers: Record<string, (...args: any[]) => void> = {};
    return { on: jest.fn((event: string, fn: (...args: any[]) => void) => { handlers[event] = fn; }), handlers };
}

function makeInteraction({ location = 'Athens' } = {}) {
    const collector = makeCollector();
    const response = { createMessageComponentCollector: jest.fn().mockReturnValue(collector) };
    return {
        options: { getString: jest.fn().mockReturnValue(location) },
        user: { id: 'user1', tag: 'User#0001', displayAvatarURL: jest.fn().mockReturnValue('https://example.com/user.png') },
        replied: false,
        isStringSelectMenu: () => false,
        reply: jest.fn().mockResolvedValue(response),
        editReply: jest.fn().mockResolvedValue({}),
        followUp: jest.fn().mockResolvedValue({}),
        _collector: collector,
    };
}

function makeWeatherData() {
    return { main: { temp: 20, humidity: 50 }, wind: { speed: 10 }, weather: [{ description: 'clear sky', icon: '01d' }] };
}

describe('weather command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.WEATHER_API_KEY = 'fake-key';
    });

    test('reports city not found when the geocoding API returns no results', async () => {
        const interaction = makeInteraction();
        (axios.get as jest.Mock).mockResolvedValue({ data: [] });

        await weather.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: '❌ City not found.' })
        );
    });

    test('sends weather directly when exactly one location matches', async () => {
        const interaction = makeInteraction();
        (axios.get as jest.Mock)
            .mockResolvedValueOnce({ data: [{ lat: 1, lon: 2, name: 'Athens', country: 'GR', state: null }] })
            .mockResolvedValueOnce({ data: makeWeatherData() });

        await weather.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) })
        );
    });

    test('shows a location picker when multiple matches are found', async () => {
        const interaction = makeInteraction();
        (axios.get as jest.Mock).mockResolvedValue({
            data: [
                { lat: 1, lon: 2, name: 'Athens', country: 'GR', state: null },
                { lat: 3, lon: 4, name: 'Athens', country: 'US', state: 'GA' },
            ],
        });

        await weather.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('found **2** locations'), components: expect.any(Array) })
        );
    });

    test('reports a generic error if the geocoding request fails and nothing was replied yet', async () => {
        const interaction = makeInteraction();
        (axios.get as jest.Mock).mockRejectedValue(new Error('network down'));

        await weather.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: '❌ Error fetching weather data.' })
        );
    });

    test('picker collect handler rejects a selection from someone else', async () => {
        const interaction = makeInteraction();
        (axios.get as jest.Mock).mockResolvedValue({
            data: [
                { lat: 1, lon: 2, name: 'Athens', country: 'GR', state: null },
                { lat: 3, lon: 4, name: 'Athens', country: 'US', state: 'GA' },
            ],
        });
        await weather.execute(interaction);

        const i = { user: { id: 'someoneElse' }, values: ['0'], reply: jest.fn().mockResolvedValue({}) };
        await interaction._collector.handlers.collect(i);

        expect(i.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('not for you') })
        );
    });

    test('picker collect handler sends weather for the selected location', async () => {
        const interaction = makeInteraction();
        (axios.get as jest.Mock)
            .mockResolvedValueOnce({
                data: [
                    { lat: 1, lon: 2, name: 'Athens', country: 'GR', state: null },
                    { lat: 3, lon: 4, name: 'Athens', country: 'US', state: 'GA' },
                ],
            })
            .mockResolvedValueOnce({ data: makeWeatherData() });
        await weather.execute(interaction);

        const i = {
            user: { id: 'user1', tag: 'User#0001', displayAvatarURL: jest.fn().mockReturnValue('https://example.com/user.png') },
            values: ['0'],
            isStringSelectMenu: () => true,
            update: jest.fn().mockResolvedValue({}),
            followUp: jest.fn().mockResolvedValue({}),
        };
        await interaction._collector.handlers.collect(i);

        expect(i.update).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array), components: [] })
        );
    });

    test('picker end handler shows a timeout message when nothing was collected', async () => {
        const interaction = makeInteraction();
        (axios.get as jest.Mock).mockResolvedValue({
            data: [
                { lat: 1, lon: 2, name: 'Athens', country: 'GR', state: null },
                { lat: 3, lon: 4, name: 'Athens', country: 'US', state: 'GA' },
            ],
        });
        await weather.execute(interaction);

        interaction._collector.handlers.end(new Map());

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: '❌ Time expired.', components: [] })
        );
    });
});
