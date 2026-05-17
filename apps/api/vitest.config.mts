import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Vitest configuration for @smart-apply/api.
 *
 * Replaces three legacy Jest configs (jest-unit.json, jest-integration.json,
 * jest-e2e.json). Suite selection is driven by the test file suffix:
 *   - *.unit.spec.ts        → unit suite        (npm run test:unit)
 *   - *.integration.spec.ts → integration suite (npm run test:integration)
 *   - *.e2e-spec.ts         → e2e suite         (npm run test:e2e)
 *
 * `globals: true` keeps describe/it/expect/beforeEach/etc. available without
 * imports — matches the legacy Jest setup. Add `"vitest/globals"` to
 * tsconfig.json#compilerOptions.types so TS knows about them.
 *
 * unplugin-swc handles TS + decorator metadata (esbuild does not emit
 * `design:*` metadata, which NestJS DI requires). It emits ES modules so
 * Vite handles all import resolution (including the @/ alias).
 *
 * vite-tsconfig-paths picks up `@/*` from tsconfig.json so we don't have
 * to maintain the alias in two places.
 */
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/*.unit.spec.ts',
      'src/**/*.integration.spec.ts',
      'test/e2e/**/*.e2e-spec.ts',
    ],
    setupFiles: ['./test/setup.ts'],
    testTimeout: 60_000,
    // Most e2e + integration suites assume serialised DB access. The unit
    // suite would tolerate parallelism, but the (small) speed win isn't
    // worth maintaining a second config.
    //
    // Vitest 4 promoted `poolOptions.<pool>` settings to top-level — the old
    // nested form was removed. See https://vitest.dev/guide/migration#pool-rework
    pool: 'forks',
    singleFork: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: '../../coverage',
      include: ['src/**/*.{ts,js}'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.e2e-spec.ts',
        'src/**/*.dto.ts',
        'src/**/*.module.ts',
        'src/main.ts',
        'src/generated/**',
      ],
    },
  },
});
