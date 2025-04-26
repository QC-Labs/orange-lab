// .eslintrc.cjs
module.exports = {
    root: true,
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
    rules: {
        'no-console': ['error', { allow: ['warn', 'error'] }],
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
    },
    env: {
        node: true,
    },
};
