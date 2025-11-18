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
    // Additional ignores to prevent linting non-code files:
    "node_modules/**",
    "**/node_modules/**",
    "**/*.md",
    "**/*.json",
    "**/*.ico",
    "**/*.png",
    "**/*.jpg",
    "**/*.jpeg",
    "**/*.gif",
    "**/*.svg",
    "**/.DS_Store",
    "**/.git/**",
    "**/docs/**",
    "**/public/**",
    "**/semantic/**",
    "**/*.tsbuildinfo",
    "**/package-lock.json",
  ]),
]);

export default eslintConfig;
