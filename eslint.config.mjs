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
  // Le client service-role (lib/supabase/service.ts) contourne TOUTE la
  // RLS : confine a src/server/services/publicShare.ts (CLAUDE.md, regle
  // absolue 4 ter). Verifie mecaniquement (V1 D-01), pas seulement par le
  // commentaire en tete de service.ts.
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["src/server/services/publicShare.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["*/lib/supabase/service", "@/lib/supabase/service", "./service", "../service"],
              message:
                "Le client service-role est confine a src/server/services/publicShare.ts (CLAUDE.md regle 4 ter). Passe par les fonctions exportees de ce fichier plutot que de construire ce client ici.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
