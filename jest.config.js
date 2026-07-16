module.exports = {
    testEnvironment: 'node',
    testPathIgnorePatterns: ['/node_modules/', '/dashboard/'],
    modulePathIgnorePatterns: ['/dashboard/'],
    preset: 'ts-jest',
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {}],
    },
    testMatch: ['**/tests/**/*.test.(js|ts)'],
};
