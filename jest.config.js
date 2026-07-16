module.exports = {
    testEnvironment: 'node',
    testPathIgnorePatterns: ['/node_modules/', '/dashboard/', '/dist/'],
    modulePathIgnorePatterns: ['/dashboard/', '/dist/'],
    preset: 'ts-jest',
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {}],
    },
    testMatch: ['**/tests/**/*.test.(js|ts)'],
};
