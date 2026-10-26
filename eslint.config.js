import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
export default [
  { ignores: ['dist/**','node_modules/**','coverage/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['src/**/*.ts','test/**/*.ts'], languageOptions: { parserOptions: { ecmaVersion: 'latest', sourceType: 'module' }, globals: { console:'readonly', process:'readonly', Buffer:'readonly', setTimeout:'readonly', setInterval:'readonly', clearInterval:'readonly', fetch:'readonly', URL:'readonly', AbortSignal:'readonly', NodeJS:'readonly' } }, rules: { '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/no-unused-vars': 'off' } }
];
