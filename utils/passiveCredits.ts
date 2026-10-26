// Passive credits share the XP cooldown (one award per minute), so the hourly ceiling is 60 x the average roll.
// Keep that below what /work pays per hour, otherwise chatting beats working.
const PASSIVE_CREDITS_MIN = 1;
const PASSIVE_CREDITS_MAX = 3;

function rollPassiveCredits(): number {
    return Math.floor(Math.random() * (PASSIVE_CREDITS_MAX - PASSIVE_CREDITS_MIN + 1)) + PASSIVE_CREDITS_MIN;
}

export { PASSIVE_CREDITS_MIN, PASSIVE_CREDITS_MAX, rollPassiveCredits };
