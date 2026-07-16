function formatDuration(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

const SPOTIFY_TRACK_URL = /open\.spotify\.com\/(?:intl-\w+\/)?track\/([A-Za-z0-9]+)/i;
const SPOTIFY_OTHER_URL = /open\.spotify\.com\/(?:intl-\w+\/)?(album|playlist|artist)\//i;

// Spotify's embed page ships track/artist names in its __NEXT_DATA__ blob and
// requires no API credentials, unlike the Web API.
async function resolveSpotifyTrackQuery(url: string): Promise<string | null> {
    const match = url.match(SPOTIFY_TRACK_URL);
    if (!match) return null;

    const res = await fetch(`https://open.spotify.com/embed/track/${match[1]}`);
    if (!res.ok) return null;

    const html = await res.text();
    const dataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (!dataMatch) return null;

    const entity = JSON.parse(dataMatch[1])?.props?.pageProps?.state?.data?.entity;
    if (!entity?.name) return null;

    const artists = (entity.artists ?? []).map((a: { name: string }) => a.name).join(', ');
    return artists ? `${entity.name} ${artists}` : entity.name;
}

export { formatDuration, SPOTIFY_TRACK_URL, SPOTIFY_OTHER_URL, resolveSpotifyTrackQuery };
