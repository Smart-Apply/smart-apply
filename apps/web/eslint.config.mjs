import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local-only build outputs (not present in CI). Without these,
    // running `npm run lint` on a developer's machine spams thousands of
    // warnings from generated bundler output.
    ".open-next/**",
    ".wrangler/**",
    ".turbo/**",
  ]),
  // Project convention: a leading underscore on an identifier signals
  // "intentionally unused" (typically for required-by-signature args
  // like `_request`, or destructured-but-skipped values like `_userId`).
  // The default `eslint-config-next` preset doesn't configure this, so
  // every `_foo` triggers `no-unused-vars` and the noise drowns out
  // actual issues. Mirror the `@typescript-eslint` recommended pattern.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]);

export default eslintConfig;
