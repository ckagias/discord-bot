const axios = require('axios');
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, MessageFlags } = require('discord.js');
const log = require('../../utils/log');
const logger = log.scope('weather');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weather')
        .setDescription('Shows weather for a city (Visible to everyone)')
        .addStringOption(option =>
            option.setName('location')
                .setDescription('City name (e.g., Athens)')
                .setRequired(true)),

    async execute(interaction) {
        const location = interaction.options.getString('location');
        const apiKey = process.env.WEATHER_API_KEY;

        try {
            const geoRes = await axios.get(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=5&appid=${apiKey}`, { timeout: 5000 });

            if (!geoRes.data.length) {
                return interaction.reply({ content: '❌ City not found.', flags: MessageFlags.Ephemeral });
            }

            const places = geoRes.data;

            if (places.length === 1) {
                return await sendWeather(interaction, places[0], apiKey);
            }

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('weather_select')
                .setPlaceholder('📍 Select the correct location...')
                .addOptions(
                    places.map((place, index) => ({
                        label: `${place.name}, ${place.state || ''} ${place.country}`.replace('  ', ' '),
                        description: `Lat: ${place.lat.toFixed(2)}, Lon: ${place.lon.toFixed(2)}`,
                        value: `${index}`,
                    }))
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);
            const response = await interaction.reply({
                content: `🔍 I found **${places.length}** locations for "${location}". Please choose one:`,
                components: [row]
            });

            const collector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: '❌ This menu is not for you!', flags: MessageFlags.Ephemeral });
                }
                const selectedPlace = places[parseInt(i.values[0])];
                await sendWeather(i, selectedPlace, apiKey);
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.editReply({ content: '❌ Time expired.', components: [] });
                }
            });

        } catch (err) {
            logger.error('Error:', err);
            if (!interaction.replied) {
                await interaction.reply({ content: '❌ Error fetching weather data.', flags: MessageFlags.Ephemeral });
            }
        }
    }
};

async function sendWeather(interaction, place, apiKey) {
    try {
        const { lat, lon, name, country, state } = place;
        const weatherRes = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=en`, { timeout: 5000 });
        const weather = weatherRes.data;
        const locationString = state ? `${name}, ${state}, ${country}` : `${name}, ${country}`;

        const embed = new EmbedBuilder()
            .setTitle(`☁️ Weather in ${locationString}`)
            .setDescription(
                `🌡️ Temperature: **${Math.round(weather.main.temp)}°C**\n` +
                `💧 Humidity: **${weather.main.humidity}%**\n` +
                `🌬️ Wind: **${weather.wind.speed} km/h**\n` +
                `🌥️ Description: **${weather.weather[0].description}**`
            )
            .setColor(Math.floor(Math.random() * 0xFFFFFF))
            .setThumbnail(`https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`)
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        if (interaction.isStringSelectMenu()) {
            await interaction.update({ content: null, embeds: [embed], components: [] });
        } else {
            await interaction.reply({ embeds: [embed] });
        }
    } catch (error) {
        logger.error('sendWeather error:', error);
        await interaction.followUp({ content: '❌ Failed to load weather details.', flags: MessageFlags.Ephemeral });
    }
};