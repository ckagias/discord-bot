const axios = require('axios');
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const { Resvg } = require('@resvg/resvg-js');
const log = require('../../utils/log');
const logger = log.scope('github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('github')
        .setDescription('Shows GitHub statistics for a user.')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('GitHub username (e.g., octocat)')
                .setRequired(true)),

    async execute(interaction) {
        const username = interaction.options.getString('username');
        await interaction.deferReply();

        try {
            const headers = {
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'Discord-Bot',
                ...(process.env.GITHUB_TOKEN && { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }),
            };

            const now = new Date();
            const fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString();

            const graphqlQuery = {
                query: `query($login: String!, $from: DateTime!) {
                    user(login: $login) {
                        contributionsCollection(from: $from) {
                            contributionCalendar { totalContributions }
                        }
                    }
                }`,
                variables: { login: username, from: fromDate },
            };

            const [userRes, reposRes, contribRes] = await Promise.all([
                axios.get(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers, timeout: 5000 }),
                axios.get(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`, { headers, timeout: 5000 }),
                process.env.GITHUB_TOKEN
                    ? axios.post('https://api.github.com/graphql', graphqlQuery, { headers, timeout: 5000 }).catch(() => null)
                    : Promise.resolve(null),
            ]);

            const user = userRes.data;
            const repos = reposRes.data;
            const totalContributions = contribRes?.data?.data?.user?.contributionsCollection?.contributionCalendar?.totalContributions ?? null;
            const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
            const topRepo = repos.sort((a, b) => b.stargazers_count - a.stargazers_count)[0];
            const createdAt = new Date(user.created_at).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            });

            const embed = new EmbedBuilder()
                .setTitle(user.login)
                .setURL(user.html_url)
                .setThumbnail(`${user.avatar_url}?v=4`)
                .setColor(Math.floor(Math.random() * 0xFFFFFF))
                .setDescription(user.bio ? `*${user.bio}*` : null);

            embed.addFields(
                {
                    name: '📊 Profile Stats',
                    value: [
                        `👥 **Followers:** ${user.followers.toLocaleString()}`,
                        `👣 **Following:** ${user.following.toLocaleString()}`,
                        `📁 **Public Repos:** ${user.public_repos.toLocaleString()}`,
                        `🔧 **Public Gists:** ${user.public_gists.toLocaleString()}`,
                    ].join('\n'),
                    inline: true,
                },
                {
                    name: '⭐ Repository Stats',
                    value: [
                        `⭐ **Total Stars:** ${totalStars.toLocaleString()}`,
                        topRepo
                            ? `🏆 **Top Repo:** [${topRepo.name}](${topRepo.html_url}) (${topRepo.stargazers_count} ⭐)`
                            : `🏆 **Top Repo:** N/A`,
                    ].join('\n'),
                    inline: true,
                }
            );

            const optionalLines = [];
            if (user.name) optionalLines.push(`📛 **Name:** ${user.name}`);
            if (user.company) optionalLines.push(`🏢 **Company:** ${user.company}`);
            if (user.location) optionalLines.push(`📍 **Location:** ${user.location}`);
            if (user.blog) optionalLines.push(`🔗 **Website:** [${user.blog}](${user.blog.startsWith('http') ? user.blog : `https://${user.blog}`})`);
            if (user.twitter_username) optionalLines.push(`🐦 **Twitter:** [@${user.twitter_username}](https://twitter.com/${user.twitter_username})`);

            if (optionalLines.length > 0) {
                embed.addFields({ name: '📌 Details', value: optionalLines.join('\n'), inline: false });
            }

            const sinceAndContribs = [
                { name: '📅 Member Since', value: createdAt, inline: true },
                ...(totalContributions !== null ? [{ name: '📝 Contributions (1y)', value: `${totalContributions.toLocaleString()} contributions last year`, inline: true }] : []),
            ];
            embed.addFields(...sinceAndContribs);

            embed
                .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            let files = [];
            try {
                const svgRes = await axios.get(`https://ghchart.rshah.org/${encodeURIComponent(username)}`, { responseType: 'text', timeout: 5000 });
                const colorMap = {
                    '#ebedf0': '#161b22',
                    '#eeeeee': '#161b22',
                    '#c6e48b': '#0e4429',
                    '#7bc96f': '#006d32',
                    '#239a3b': '#26a641',
                    '#196127': '#39d353',
                };
                let svg = svgRes.data
                    .replace(/fill:([^;]+)/g, (_, c) => `fill:${colorMap[c.trim()] ?? c}`)
                    .replace(/x="(\d+)"/g, (_, n) => `x="${parseInt(n) - 25}"`)
                    .replace(/width="663"/, 'width="638"');

                const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 800 } });
                const pngBuffer = resvg.render().asPng();
                const attachment = new AttachmentBuilder(pngBuffer, { name: 'contributions.png' });
                embed.setImage('attachment://contributions.png');
                files = [attachment];
            } catch (e) { logger.error('chart error:', e.message); }

            await interaction.editReply({ embeds: [embed], files });

        } catch (err) {
            if (err.response?.status === 404) {
                await interaction.editReply({ content: `GitHub user **${username}** was not found.`, flags: MessageFlags.Ephemeral });
            } else if (err.response?.status === 403) {
                await interaction.editReply({ content: 'GitHub API rate limit exceeded. Please try again later.', flags: MessageFlags.Ephemeral });
            } else {
                logger.error('Error:', err);
                await interaction.editReply({ content: 'An error occurred while fetching GitHub data.', flags: MessageFlags.Ephemeral });
            }
        }
    }
};