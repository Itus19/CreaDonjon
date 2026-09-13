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
    // Fichiers de test SERIALISES, jamais en parallele (retour utilisateur,
    // apres depassement du quota Supabase MAU/Egress) : depuis que les
    // tests d'integration partagent un petit pool de comptes reutilisables
    // (src/server/testUtils/reusableTestAccounts.ts) plutot qu'un compte
    // jetable par fichier, deux fichiers executes EN MEME TEMPS sur le meme
    // compte se marchent dessus — le nettoyage "tous les mondes de ce
    // proprietaire" d'un fichier qui termine peut supprimer le monde qu'un
    // AUTRE fichier, encore en cours, est en train d'utiliser (constate en
    // pratique : `share_links_world_id_fkey` viole en plein test). Un seul
    // fichier actif a la fois l'evite completement, sans retoucher le
    // nettoyage de chaque fichier. Cout accepte : la suite d'integration
    // (deja lente, vrais appels reseau) perd son parallelisme interne —
    // `test:core` (src/core, pur, ~1s) n'en souffre pas a cette echelle.
    fileParallelism: false,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/core/**/*.ts"],
      exclude: ["src/core/**/*.test.ts"],
    },
  },
});
