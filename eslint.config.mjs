import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// eslint-config-next 16.x ships native flat-config arrays (see
// node_modules/eslint-config-next/dist/{core-web-vitals,typescript}.js —
// both `module.exports = config` where config is already a flat-config
// array), so these are spread directly rather than routed through
// @eslint/eslintrc's FlatCompat, which is for wrapping *legacy*
// shareable configs and mangles an already-flat array into an invalid,
// self-referential config object.
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    // CLI/seed scripts — console output here is the actual UX (progress,
    // diagnostics), not incidental debug logging left behind.
    files: ["scripts/**/*.ts", "prisma/seed.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "dist/**"],
  },
];

export default eslintConfig;
