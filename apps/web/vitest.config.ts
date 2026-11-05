import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'node',
    globals: true,
    include: ['apps/web/test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.pnpm-store/**', 'apps/api/**'],
  },
});
