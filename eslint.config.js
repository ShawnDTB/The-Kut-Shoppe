import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'dist-ssr/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.vite(),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2023 },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    files: [
      'src/components/InternalBookingPage.tsx',
      'src/components/StaffPlatformPages.tsx',
      'src/components/CustomerAccountPrototype.tsx',
      'src/components/CommercePlatformPages.tsx',
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^(BarberDirectoryEntry|useMemo|isValidEmail|isManagerRole)$',
      }],
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/use-memo': 'off',
    },
  },
  {
    files: ['src/components/BookingV4.tsx'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
  {
    files: ['src/components/RoleDashboardV4.tsx'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
);
