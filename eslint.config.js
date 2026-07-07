const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-undef': 'error',
            'no-unreachable': 'error',
            'require-await': 'warn',
            'no-async-promise-executor': 'error',
            'no-empty': ['error', { allowEmptyCatch: true }],
        },
    },
    {
        files: ['**/*.test.js'],
        languageOptions: {
            globals: {
                ...globals.jest,
            },
        },
    },
    {
        ignores: ['node_modules/', 'dashboard/', 'data/', 'lavalink/'],
    },
];
