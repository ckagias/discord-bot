import { formatDuration } from '../../utils/duration';

describe('formatDuration', () => {
    test('formats seconds only', () => {
        expect(formatDuration(45_000)).toBe('45s');
    });

    test('formats minutes and seconds', () => {
        expect(formatDuration(90_000)).toBe('1m 30s');
    });

    test('formats hours and minutes, dropping seconds beyond the 2-unit cap', () => {
        expect(formatDuration(5_430_000)).toBe('1h 30m');
    });

    test('formats days and hours', () => {
        expect(formatDuration(97_200_000)).toBe('1d 3h');
    });

    test('formats weeks and days', () => {
        expect(formatDuration(788_400_000)).toBe('1w 2d');
    });

    test('drops trailing zero units instead of showing "1w 0d"', () => {
        expect(formatDuration(604_800_000)).toBe('1w');
    });

    test('returns "0s" for a zero duration', () => {
        expect(formatDuration(0)).toBe('0s');
    });

    test('rounds sub-second precision to the nearest second', () => {
        expect(formatDuration(1_499)).toBe('1s');
    });
});
