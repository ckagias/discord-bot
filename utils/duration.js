// Formats a duration in milliseconds as an exact compound string (e.g. "1h 30m"),
// never rounding away the remainder the way a single-unit label like "2h" would.
function formatDuration(ms) {
    let seconds = Math.round(ms / 1000);

    const units = [
        ['w', 604800],
        ['d', 86400],
        ['h', 3600],
        ['m', 60],
    ];

    const parts = [];
    for (const [label, size] of units) {
        if (seconds >= size) {
            const count = Math.floor(seconds / size);
            parts.push(`${count}${label}`);
            seconds -= count * size;
        }
    }
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.slice(0, 2).join(' ');
}

module.exports = { formatDuration };
