import globals from 'globals';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import pulumiPlugin from '@pulumi/eslint-plugin';

export default tseslint.config(
    {
        ignores: ['node_modules/**', 'bin/**'],
    },
    {
        files: ['**/*.{js,mjs,ts}'],
    },
    {
        languageOptions: {
            globals: {
                ...globals.node,
            },
            parserOptions: {
                projectService: {
                    allowDefaultProject: ['*.mjs'],
                },
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    eslint.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
        plugins: { pulumi: pulumiPlugin },
        rules: {
            '@typescript-eslint/consistent-type-definitions': 'error',
            '@typescript-eslint/method-signature-style': ['error', 'property'],
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    args: 'all',
                    argsIgnorePattern: '^_',
                    caughtErrors: 'all',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                },
            ],
            '@typescript-eslint/prefer-includes': 'error',
            '@typescript-eslint/prefer-nullish-coalescing': 'error',
            '@typescript-eslint/prefer-optional-chain': 'error',
            '@typescript-eslint/prefer-string-starts-ends-with': 'error',
            '@typescript-eslint/unified-signatures': 'error',
            'no-console': 'error',
            'object-curly-newline': [
                'error',
                {
                    ImportDeclaration: { multiline: true },
                },
            ],
            'object-shorthand': ['error', 'always'],
            'prefer-arrow-callback': 'error',
            'sort-keys': ['error', 'asc', { minKeys: 10 }],
        },
    },
);
