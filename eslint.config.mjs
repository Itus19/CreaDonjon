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
    // Rapport genere par `npm run test:coverage`, jamais suivi par Git.
    "coverage/**",
  ]),
  // src/core est un noyau pur (CLAUDE.md, regle absolue 14) : aucun import
  // de framework ni de reseau. Verifie mecaniquement, pas seulement par
  // convention.
  {
    files: ["src/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*"],
              message: "src/core est un noyau pur : aucun import de next.",
            },
            {
              group: ["react", "react/*", "react-dom", "react-dom/*"],
              message: "src/core est un noyau pur : aucun import de react.",
            },
            {
              group: ["@supabase/*", "@supabase/**"],
              message: "src/core est un noyau pur : aucun import de @supabase.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
