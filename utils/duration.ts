// Compound format (e.g. "1h 30m") never rounds away the remainder like a single-unit label would.
function formatDuration(ms: number): string {
    let seconds = Math.round(ms / 1000);

    const units: [string, number][] = [
        ['w', 604800],
        ['d', 86400],
        ['h', 3600],
        ['m', 60],
    ];

    const parts: string[] = [];
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

export { formatDuration };
