# Backlog V3.1 — Dette technique (V3.1-120…)

Partie de [`BACKLOG_V3.1.md`](../BACKLOG_V3.1.md), qui tient la feuille de route et l'index des tickets. Les tickets terminés (☑) sont dans [`termines.md`](termines.md).

Ce qui ne se voit pas à l'écran mais rend le code fragile à modifier. Relevé par des audits ponctuels (ADR 0054), pas en jouant.

---

### ☐ V3.1-120 — Défaire les cycles d'import (services serveur, fiche jouable) · `M` — **prêt**

**Modèle conseillé : Sonnet** — refactorisation sans changement de comportement ; les tests existants font foi.

**Sous-tâches Haiku** (`aide-haiku`) : recenser, avant de coder, chaque import de la liste ci-dessous et ses usages ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Constat (audit Graphify du 10 octobre, ADR 0054).** Huit cycles d'import. Rien ne casse aujourd'hui, mais un cycle rend l'ordre de chargement fragile. Une constante peut valoir `undefined` au moment où un module la lit. Et on ne peut plus toucher à un fichier sans tirer les autres. La refonte va justement modifier la fiche jouable et l'assistant de montée de niveau (V3.1-26, 48 à 53).

**Les cycles et l'import qui les ferme**

*Composants*, deux cycles : `LevelUpWizard` → `AsiStep` / `RemainingChoicesStep` → `PlayableCharacterSheet` → `LevelUpWizard`.
- `AsiStep.tsx` et `RemainingChoicesStep.tsx` n'importent de `PlayableCharacterSheet.tsx` que deux constantes, `ABILITY_LABELS` et `SORTED_SKILLS`.
- `ABILITY_LABELS` existe déjà dans `src/core/rules/sheet.ts`. S'il est identique, utiliser celui-là ; sinon, garder la version française la plus complète et le dire.
- `SORTED_SKILLS` va dans un petit module sans composant, par exemple `components/blocks/skillOrder.ts`. `PlayableCharacterSheet.tsx` l'importe de là.

*Services serveur* (`src/server/services/`), six cycles qui passent par ces imports :

| Fichier | Importe | Depuis |
|---|---|---|
| `campaigns.ts` | `createEntity`, `listEntities` | `entities.ts` |
| `entities.ts` | `listPlayerCharacterEntityIds` | `worldPlayerCharacters.ts` |
| `entities.ts` | `getSessionJournalTreeGroup` | `sessionJournal.ts` |
| `worldPlayerCharacters.ts` | `listCampaigns` | `campaigns.ts` |
| `worldPlayerCharacters.ts` | `assembleResolvedRuleset` | `resolvedRuleset.ts` |
| `sessionJournal.ts` | `createEntity` | `entities.ts` |
| `sessionJournal.ts` | `getCalendar` | `worlds.ts` |
| `worlds.ts` | `createCampaign`, `listWorldPlayerCharacters` | `campaigns.ts`, `worldPlayerCharacters.ts` |
| `rules.ts` | `getWorldBySlug` | `worlds.ts` |
| `resolvedRuleset.ts` | `resolveEntryBlocksInRuleset…`, `walkRulesetChain` | `rules.ts` |

**Méthode**, dans cet ordre, en gardant chaque fonction publique et sa signature :
1. **Quand le service importé ne fait que relayer un repo** (`listCampaigns`, `getCalendar`, `getWorldBySlug` sont les premiers à vérifier) : appeler directement la fonction de `src/server/repos/`. Un service peut toujours importer un repo.
2. **Sinon, déplacer la fonction partagée vers le bas**, dans le module dont elle dépend vraiment, ou dans un nouveau module de service « feuille » qui n'importe aucun des fichiers du cycle. Par exemple, les lectures des PJ d'un monde, utilisées par `entities.ts` et `worlds.ts`.
3. Ne jamais casser un cycle par un `import()` dynamique, ni en dupliquant une requête. Une requête Supabase reste dans `src/server/repos/` (règle 20).

**Garde-fou.** Activer `import/no-cycle` dans `eslint.config.mjs`, pour `src/` et `components/`. La règle vient de `eslint-plugin-import`, déjà présent dans `node_modules` ; s'il n'est pas une dépendance directe, le dire avant de l'ajouter à `package.json`. Le lint échoue désormais sur tout nouveau cycle.

**Critères d'acceptation**
- [ ] `import/no-cycle` actif ; `npm run lint` passe sans aucune exception désactivée.
- [ ] Aucune signature publique changée ; aucun test modifié, sauf ses imports.
- [ ] `npm run typecheck && npm run lint && npm run test` passent.
- [ ] Une note de clôture liste, pour chaque cycle, l'import déplacé et sa nouvelle source.

---

### ☐ V3.1-126 — Les `catch` muets restants · `M` — **prêt (Sonnet ; Haiku pour le recensement)**

**Modèle conseillé : Sonnet.** Sous-tâches Haiku : recenser les occurrences et les classer par fichier (`grep -rn "catch {\|\.catch(() => {})" app components lib src`, tests exclus).

`CLAUDE.md` interdit le `catch` silencieux. Le 12 octobre, il en reste **55, dans 44 fichiers**. Ceux touchés par V3.1-62 ont été corrigés en passant (chargeurs de la fiche, pastille du chat, radio, dés, liste des règles, découverte d'une fiche joueuse). Les autres datent d'avant la règle.

**Méthode**, fichier par fichier, sans changer le comportement visible :
- un échec qui doit rester sans effet pour l'utilisateur (geste « au mieux ») garde son repli, mais **journalise** l'erreur (`console.error` avec ce qui a échoué) ;
- un échec qui laisse un écran sur un état faux reçoit l'état d'erreur de la charte (`docs/CHARTE-UI.md`, états d'écran) ;
- un `fetch` qui ne teste pas `res.ok` le teste (charte : « un `fetch` dont on ne teste pas `res.ok` est un bug »).

**Garde-fou.** Ajouter le motif au cliquet `lib/cablage.test.ts`, plafond au compte du jour, abaissé à chaque lot.

**Critères d'acceptation**
- [ ] Plus aucun `catch` sans traitement de l'erreur hors des tests.
- [ ] Le cliquet compte les `catch` muets et échoue s'ils augmentent.
- [ ] `npm run typecheck && npm run lint && npm run test` passent.

---

### ☑ V3.1-127 — Mettre à jour Next et les dépendances vulnérables · `S` — **fait le 12 octobre**

**Modèle conseillé : Opus**, car le changement de version de Next touche tout le rendu. Sous-tâches Haiku : lancer `npm audit --omit=dev`, typecheck, lint, tests et build, et résumer les échecs.

Le 12 octobre, `npm audit --omit=dev` relève 32 failles (1 critique, 6 hautes, 25 moyennes), inscrites au registre de `docs/SECURITE.md` §3.
- **Next 16.2.12** : plusieurs failles corrigées en 16.3.8, dont des exécutions de code à distance (optimisation d'images AVIF, `next/og`, serveur Windows) et une falsification de requête par l'optimisation d'images. Le code n'utilise ni `next/image` ni `next/og` : exposition faible, mais `/_next/image` répond quand même.
- **Éditeur** : `@tiptap/core` et `prosemirror-view` (XSS au collage) ; correctif dans les versions permises.
- **Outillage** : `sharp`, `postcss` (suivent Next), `nanoid`, `source-map-js`.

**Méthode**
1. Monter `next` (et `eslint-config-next`) à la dernière 16.x, au moins 16.3.8 ; lire ses notes de version pour les changements de comportement.
2. `npm audit fix`, **sans** `--force`.
3. `npm run typecheck && npm run lint && npm run test`, `npm run build`, `npm run verifier:secrets`.
4. Parcours à la main (`docs/TESTS.md`) : une fiche de personnage, l'éditeur (coller du texte), un portrait téléversé, une page partagée.
5. Passer la ligne du registre à *corrigée*.

**Fait le 12 octobre.**
- **Next 16.3.8**, pas 16.4.0 : dernière version corrective de la ligne 16.3, qui corrige toutes les failles relevées ; 16.4.0 (six jours) apporte des nouveautés, donc plus de changements possibles. `eslint-config-next` suit.
- **Tiptap 3.31.4**, toutes les extensions ensemble (elles exigent la même version exacte). Le fichier de verrouillage gardait l'ancienne version de chaque extension : ses entrées Tiptap ont été retirées pour que npm les résolve à neuf, puis `npm ci` a prouvé qu'il s'installe proprement depuis zéro.
- `sharp`, `nanoid`, `source-map-js` montés dans leurs versions permises (`npm update`).
- `npm audit fix` plante avec npm 10.9 (`edgesOut`) : les mises à jour ont été faites paquet par paquet.
- **Parcours à la main** sur le build de production (`next start`), Banc d'essai, Chromium :
  - fiche de personnage côté MJ et côté joueuse : CA 16, PV 12/12 ;
  - éditeur : bloc Texte ajouté à la faction, frappe et collage enregistrés et relus ; une image collée avec un script caché (`onerror`) ne l'exécute pas ; bloc supprimé ensuite ;
  - page partagée avec un jeton inconnu : 404 prévu, pas d'erreur serveur ; en-têtes de sécurité présents.
  - Téléversement d'image : *erreur corrigée le 12 octobre*. Ce ticket affirmait d'abord que notre code n'utilisait pas `sharp` : faux, il le charge à la demande (`await import("sharp")`, `src/server/services/assetUpload.ts`, `blockImageUpload.ts`, `backgroundImageProcessing.ts`), forme que la recherche n'avait pas trouvée. Vérifié ensuite sur la machine, sans rien téléverser, avec `sharp` 0.35.5 et les réglages exacts de l'app : une carte PNG de 19,6 Mo (5760 px) devient un WebP de 537 ko à 4096 px, 168 ko à 1600 px, 30 ko en portrait ; un faux fichier est refusé proprement. L'envoi vers le stockage (`supabase-js`) n'a pas changé de version.
- **Nouveau en 16.3** : la règle de lint `no-location-assign-relative-destination` signalait `components/shell/CommandPalette.tsx` (navigation par `window.location.href`, donc rechargement complet). Corrigé le même jour : `router.push`. Cette branche ne sert que hors du bureau de fenêtres, qui entoure aujourd'hui toutes les pages d'un monde ; aucun écran actuel ne change.
- **Outils de développement**, le même jour : 10 → 5 failles avec npm 11 (Vitest 4.1.11, `brace-expansion`, `js-yaml`) ; les 5 restantes n'ont aucun correctif publié (`docs/SECURITE.md` §6).

**Critères d'acceptation**
- [x] `npm audit --omit=dev` ne relève plus de faille critique ni haute, ou chaque reste est justifié au registre. *0 faille en production ; les 10 restes des outils de développement sont justifiés dans `docs/SECURITE.md` §6.*
- [x] `npm run typecheck && npm run lint && npm run test` et le build passent.
- [x] Le parcours à la main ne montre aucune régression.
