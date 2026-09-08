import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // `server-only` (marker package) throw par defaut ; Next.js le
      // resout vers son propre no-op via la condition d'export
      // "react-server" au moment du build. Vitest ne connait pas cette
      // condition — alias cible, uniquement ce paquet, plutot que
      // d'activer "react-server" globalement (qui changerait la
      // resolution d'autres paquets, React inclus, de facon plus large
      // que ce dont ce projet a besoin).
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
      // Meme alias "@/*" -> racine du projet que tsconfig.json : necessaire
      // des qu'un test importe (directement ou en cascade) un fichier
      // applicatif qui utilise cet alias, comme publicShare.ts.
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // `lib/` ajoute a `src/` (B-06) : les schemas Zod partages y vivent, et
    // jusqu'ici aucun test place a cote d'eux n'aurait ete execute — un
    // test invisible est pire qu'un test absent. `test:core` reste borne a
    // `src/core` par son argument de ligne de commande, inchange.
    include: ["src/**/*.test.ts", "lib/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/core/**/*.ts"],
      exclude: ["src/core/**/*.test.ts"],
    },
  },
});
