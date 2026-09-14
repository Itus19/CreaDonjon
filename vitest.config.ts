import { fileURLToPath } from "node:url";
import { defaultExclude, defineConfig } from "vitest/config";

/**
 * Tous les fichiers de test du depot. `lib/` ajoute a `src/` (B-06) : les
 * schemas Zod partages y vivent, et jusqu'ici aucun test place a cote d'eux
 * n'aurait ete execute — un test invisible est pire qu'un test absent.
 * `test:core` reste borne a `src/core` par son argument de ligne de
 * commande, inchange.
 */
const ALL_TEST_GLOBS = ["src/**/*.test.ts", "lib/**/*.test.ts"];

/**
 * Motif des tests d'integration : un fichier `*.integration.test.ts`, quelle
 * que soit sa place dans `src/` ou `lib/`. Sert deux fois — a EXCLURE du
 * projet "unit", a INCLURE dans le projet "integration" — d'ou la constante.
 */
const INTEGRATION_GLOBS = ["src/**/*.integration.test.ts", "lib/**/*.integration.test.ts"];

/**
 * Delai d'attente des tests d'integration. Ils touchent la VRAIE base
 * Supabase (reseau reel, latence hors de notre controle) : le defaut de
 * Vitest, 5000 ms, ne laissait aucune marge. Constate le 14 septembre 2026
 * sur `homebrewWeapon.integration.test.ts` — corps mesure entre 3 et 4,2 s,
 * donc un echec "Test timed out in 5000ms" par intermittence, sur master
 * comme sur une branche de travail. Ce n'etait pas une regression : la marge
 * etait trop mince.
 *
 * 30 s, soit environ sept fois le pire temps mesure. Volontairement large :
 * ce qu'on veut detecter ici, c'est un test REELLEMENT bloque, pas une
 * requete un peu lente. Le cout d'un delai large est nul tant que les tests
 * passent, et borne quand l'un d'eux bloque (les fichiers sont serialises,
 * cf. `fileParallelism` plus bas).
 *
 * `hookTimeout` suit la meme regle : les `beforeAll` de ces fichiers
 * enchainent eux aussi plusieurs allers-retours reseau (connexion du compte
 * de test, lecture du ruleset officiel, insertion de la variante).
 */
const INTEGRATION_TIMEOUT_MS = 30_000;

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
    // Deux projets pour une seule raison : le delai d'attente. Les tests
    // purs (`src/core` en tete) s'executent en millisecondes — leur laisser
    // 30 s serait perdre le filet qui compte le plus la-bas, ou un test qui
    // depasse son delai signale une boucle infinie, pas une latence reseau.
    // Les tests d'integration, eux, ne peuvent pas vivre avec 5 s. Vitest
    // n'offre pas de delai par glob a l'interieur d'un projet : la
    // separation en projets EST le mecanisme prevu pour ca.
    //
    // `extends: true` fait heriter chaque projet de tout ce qui est declare
    // au-dessus (alias, environment, setupFiles, fileParallelism) ; seuls
    // les fichiers concernes et le delai different. La serialisation reste
    // globale, les deux projets confondus.
    //
    // `include` est declare ici, jamais a la racine : `extends: true`
    // CONCATENE les tableaux herites au lieu de les remplacer, donc un
    // `include` racine ramenerait TOUS les fichiers dans le projet
    // "integration" (et leur donnerait le delai large qu'on veut justement
    // leur refuser).
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ALL_TEST_GLOBS,
          exclude: [...defaultExclude, ...INTEGRATION_GLOBS],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: INTEGRATION_GLOBS,
          testTimeout: INTEGRATION_TIMEOUT_MS,
          hookTimeout: INTEGRATION_TIMEOUT_MS,
        },
      },
    ],
  },
});
