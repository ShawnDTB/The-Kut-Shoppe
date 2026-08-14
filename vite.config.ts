/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    // These modules read window.localStorage per-call rather than caching a
    // reference, so a real, working Storage implementation is needed for
    // accurate coverage (see src/test/setup.ts for why that isn't just
    // "environment: jsdom" out of the box) -- but that also means test state
    // leaks across files unless each test file clears storage itself. See
    // the beforeEach(() => localStorage.clear()) at the top of each test file.
    restoreMocks: true,
  },
});
