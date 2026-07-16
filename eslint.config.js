const js = require('@eslint/js');
const globals = require('globals');
const tseslint = require('typescript-eslint');

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
    ...tseslint.configs.recommended.map((config) => ({
        ...config,
        files: ['**/*.ts'],
    })),
    {
        files: ['**/*.ts'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
        rules: {
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-unused-vars': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-require-imports': 'warn',
        },
    },
    {
        files: ['**/*.test.js', '**/*.test.ts'],
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
